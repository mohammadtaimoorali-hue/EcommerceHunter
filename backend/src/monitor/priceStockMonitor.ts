// Price & stock monitor (spec sections 16-17): re-checks every active/paused
// listing's source product for price and stock changes, persists history,
// and reacts:
//   - out of stock  -> pause (or end, per setting) the marketplace listing
//   - back in stock -> restore quantity/price and resume the listing
//   - price changed -> recalculate profitability; if still profitable, push
//                       a clamped price update; if not, pause/end per setting
//
// Pure-ish: takes the connectors it needs to talk to as an explicit map so it
// never has to know how connectors are wired up (tests can inject fakes).
import type { PrismaClient } from '@prisma/client';
import type { SourceConnector } from '../connectors/base';
import type { MarketplaceAdapter } from '../marketplace/base';
import { calculateProfitability } from '../engines/profitability';
import { calculateTargetPrice } from '../engines/pricing';
import { getSetting, MonitorSettings } from '../lib/settings';

export type { MonitorSettings };

export interface MonitorListingDetail {
  listingId: string;
  externalId: string | null;
  title: string;
  events: string[];
  reasons: string[];
}

export interface MonitorSummary {
  checked: number;
  skippedNoConnector: number;
  priceChanges: number;
  stockOuts: number;
  stockRestored: number;
  paused: number;
  resumed: number;
  ended: number;
  unprofitablePaused: number;
  details: MonitorListingDetail[];
}

async function logEvent(
  prisma: PrismaClient,
  listingId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await prisma.listingEvent.create({
    data: { listingId, type, payload: JSON.stringify(payload) },
  });
}

export async function runPriceStockMonitor(
  prisma: PrismaClient,
  marketplace: MarketplaceAdapter,
  connectors: Record<string, SourceConnector>,
  /**
   * Restrict to listings belonging to this store. A marketplace adapter
   * instance corresponds to one store's connection — without this, a
   * multi-store deployment would let this function try to act on another
   * store's listings through the wrong adapter instance.
   */
  storeId?: string,
): Promise<MonitorSummary> {
  const feeSettings = await getSetting<{
    ebayFvfRate: number;
    paymentProcessingRate: number;
    paymentProcessingFlatFee: number;
    businessOverheadRate: number;
  }>(prisma, 'fee_settings');
  const desiredMarginPercent = await getSetting<number>(prisma, 'desired_margin_percent');
  const safetyLimits = await getSetting<{
    MIN_PROFIT_AUD: number;
    MIN_MARGIN_PERCENT: number;
    MAX_PRICE_CHANGE_PERCENT: number;
  }>(prisma, 'safety_limits');
  const monitorSettings = await getSetting<MonitorSettings>(prisma, 'monitor_settings');

  await marketplace.connect();

  const listings = await prisma.listing.findMany({
    where: { status: { in: ['ACTIVE', 'PAUSED'] }, ...(storeId ? { storeId } : {}) },
    include: {
      listingDraft: { include: { canonicalProduct: { include: { sourceProducts: { include: { source: true } } } } } },
    },
  });

  const summary: MonitorSummary = {
    checked: 0,
    skippedNoConnector: 0,
    priceChanges: 0,
    stockOuts: 0,
    stockRestored: 0,
    paused: 0,
    resumed: 0,
    ended: 0,
    unprofitablePaused: 0,
    details: [],
  };

  for (const listing of listings) {
    if (!listing.externalId) continue;
    const externalId: string = listing.externalId;

    const sourceProduct = listing.listingDraft.canonicalProduct.sourceProducts.find(
      (sp) => connectors[sp.source.key],
    );
    if (!sourceProduct) {
      summary.skippedNoConnector++;
      continue;
    }
    const connector = connectors[sourceProduct.source.key];

    const [priceSnap, stockSnap] = await Promise.all([
      connector.getPrice(sourceProduct.externalId),
      connector.getStock(sourceProduct.externalId),
    ]);
    if (!priceSnap || !stockSnap) {
      summary.skippedNoConnector++;
      continue;
    }

    summary.checked++;
    const events: string[] = [];
    const reasons: string[] = [];

    const [previousPrice, previousStock] = await Promise.all([
      prisma.productPrice.findFirst({
        where: { sourceProductId: sourceProduct.id },
        orderBy: { capturedAt: 'desc' },
      }),
      prisma.productStock.findFirst({
        where: { sourceProductId: sourceProduct.id },
        orderBy: { capturedAt: 'desc' },
      }),
    ]);

    // Persist history first — never overwrite past snapshots.
    await prisma.productPrice.create({
      data: { sourceProductId: sourceProduct.id, price: priceSnap.price, currency: priceSnap.currency },
    });
    await prisma.productStock.create({
      data: { sourceProductId: sourceProduct.id, inStock: stockSnap.inStock, quantity: stockSnap.quantity },
    });

    let currentListing = listing;
    let endedThisRun = false;

    // --- STOCK LOGIC ---
    const wasInStock = previousStock ? previousStock.inStock : true;
    if (!stockSnap.inStock && currentListing.status === 'ACTIVE') {
      summary.stockOuts++;
      if (monitorSettings.onOutOfStock === 'END') {
        await marketplace.endListing(externalId);
        currentListing = await prisma.listing.update({
          where: { id: currentListing.id },
          data: { status: 'ENDED', quantity: 0 },
          include: {
            listingDraft: {
              include: { canonicalProduct: { include: { sourceProducts: { include: { source: true } } } } },
            },
          },
        });
        events.push('ENDED');
        reasons.push('Source product went out of stock.');
        summary.ended++;
        endedThisRun = true;
      } else {
        await marketplace.updateInventory(externalId, 0);
        currentListing = await prisma.listing.update({
          where: { id: currentListing.id },
          data: { status: 'PAUSED', quantity: 0 },
          include: {
            listingDraft: {
              include: { canonicalProduct: { include: { sourceProducts: { include: { source: true } } } } },
            },
          },
        });
        events.push('PAUSED');
        reasons.push('Source product went out of stock.');
        summary.paused++;
      }
      await logEvent(prisma, currentListing.id, events[events.length - 1], {
        reason: 'out_of_stock',
      });
    } else if (stockSnap.inStock && !wasInStock && currentListing.status === 'PAUSED') {
      // Recovering from a stock-out pause specifically (not a manual pause).
      const lastEvent = await prisma.listingEvent.findFirst({
        where: { listingId: currentListing.id },
        orderBy: { createdAt: 'desc' },
      });
      const wasPausedForStock =
        lastEvent?.type === 'PAUSED' &&
        (() => {
          try {
            return JSON.parse(lastEvent.payload ?? '{}').reason === 'out_of_stock';
          } catch {
            return false;
          }
        })();
      if (wasPausedForStock) {
        await marketplace.updateInventory(externalId, stockSnap.quantity ?? 1);
        currentListing = await prisma.listing.update({
          where: { id: currentListing.id },
          data: { status: 'ACTIVE', quantity: stockSnap.quantity ?? 1 },
          include: {
            listingDraft: {
              include: { canonicalProduct: { include: { sourceProducts: { include: { source: true } } } } },
            },
          },
        });
        events.push('RESUMED');
        reasons.push('Source product is back in stock.');
        summary.stockRestored++;
        summary.resumed++;
        await logEvent(prisma, currentListing.id, 'RESUMED', { reason: 'back_in_stock' });
      }
    }

    // --- PRICE LOGIC --- (skip if we just ended the listing above)
    if (!endedThisRun && currentListing.status === 'ACTIVE' && previousPrice) {
      const changePercent =
        previousPrice.price > 0
          ? (Math.abs(priceSnap.price - previousPrice.price) / previousPrice.price) * 100
          : 0;

      if (changePercent >= monitorSettings.minPriceChangePercent) {
        const draft = currentListing.listingDraft;
        const competitors = await prisma.competitor.findMany({
          where: { canonicalProductId: draft.canonicalProductId },
        });
        const costInputs = {
          retailPrice: priceSnap.price,
          shippingCost: 0,
          ebayFvfRate: feeSettings.ebayFvfRate,
          paymentProcessingRate: feeSettings.paymentProcessingRate,
          paymentProcessingFlatFee: feeSettings.paymentProcessingFlatFee,
          businessOverheadRate: feeSettings.businessOverheadRate,
        };
        const pricing = calculateTargetPrice({
          costInputs,
          desiredMarginPercent,
          competitorPrices: competitors.map((c) => c.price),
          priceMin: draft.priceMin,
          priceMax: draft.priceMax,
        });
        const profitability = calculateProfitability({ ...costInputs, sellPrice: pricing.targetPrice });

        const meetsSafety =
          profitability.profit >= safetyLimits.MIN_PROFIT_AUD &&
          profitability.marginPercent >= safetyLimits.MIN_MARGIN_PERCENT;

        if (meetsSafety) {
          const maxDelta = currentListing.currentPrice * (safetyLimits.MAX_PRICE_CHANGE_PERCENT / 100);
          let newPrice = pricing.targetPrice;
          if (newPrice > currentListing.currentPrice + maxDelta) newPrice = currentListing.currentPrice + maxDelta;
          if (newPrice < currentListing.currentPrice - maxDelta) newPrice = currentListing.currentPrice - maxDelta;
          newPrice = Math.round(newPrice * 100) / 100;

          if (Math.abs(newPrice - currentListing.currentPrice) >= 0.01) {
            await marketplace.updatePrice(externalId, newPrice);
            const oldPrice = currentListing.currentPrice;
            currentListing = await prisma.listing.update({
              where: { id: currentListing.id },
              data: { currentPrice: newPrice },
              include: {
                listingDraft: {
                  include: { canonicalProduct: { include: { sourceProducts: { include: { source: true } } } } },
                },
              },
            });
            events.push('PRICE_CHANGE');
            reasons.push(
              `Retail price moved ${changePercent.toFixed(1)}%; listing price updated $${oldPrice} -> $${newPrice}.`,
            );
            summary.priceChanges++;
            await logEvent(prisma, currentListing.id, 'PRICE_CHANGE', {
              oldPrice,
              newPrice,
              retailPrice: priceSnap.price,
              marginPercent: profitability.marginPercent,
            });
          }
        } else {
          summary.unprofitablePaused++;
          if (monitorSettings.onUnprofitable === 'END') {
            await marketplace.endListing(externalId);
            currentListing = await prisma.listing.update({
              where: { id: currentListing.id },
              data: { status: 'ENDED' },
              include: {
                listingDraft: {
                  include: { canonicalProduct: { include: { sourceProducts: { include: { source: true } } } } },
                },
              },
            });
            events.push('ENDED');
            summary.ended++;
          } else {
            await marketplace.updateInventory(externalId, 0);
            currentListing = await prisma.listing.update({
              where: { id: currentListing.id },
              data: { status: 'PAUSED', quantity: 0 },
              include: {
                listingDraft: {
                  include: { canonicalProduct: { include: { sourceProducts: { include: { source: true } } } } },
                },
              },
            });
            events.push('PAUSED');
            summary.paused++;
          }
          reasons.push(
            `Retail price rose to $${priceSnap.price}; margin ${profitability.marginPercent}% no longer meets safety limits.`,
          );
          await logEvent(prisma, currentListing.id, events[events.length - 1], {
            reason: 'unprofitable',
            retailPrice: priceSnap.price,
            marginPercent: profitability.marginPercent,
          });
        }
      }
    }

    if (events.length > 0) {
      summary.details.push({
        listingId: currentListing.id,
        externalId: currentListing.externalId,
        title: currentListing.listingDraft.title,
        events,
        reasons,
      });
    }
  }

  return summary;
}
