// Full dry-run pipeline: discovery -> normalize -> dedupe -> score ->
// profitability -> risk -> listing-gen -> validate -> MockEbayAdapter publish.
// Never touches the real EbayAdapter. Returns a summary object plus enough
// detail for the e2e test to assert on.
import type { PrismaClient } from '@prisma/client';
import type { SourceConnector } from '../connectors/base';
import type { MarketplaceAdapter } from '../marketplace/base';
import { findCanonicalMatch, CandidateProduct } from '../engines/duplicates';
import { assessRisk } from '../engines/risk';
import {
  calculateOpportunityScore,
  stockScoreFromQuantity,
  competitionScoreFromCount,
  riskScoreFromStatus,
} from '../engines/scoring';
import { calculateProfitability } from '../engines/profitability';
import { calculateTargetPrice } from '../engines/pricing';
import { generateListing } from '../listing/generate';
import { getSetting } from '../lib/settings';

export interface DryRunSummary {
  candidatesFound: number;
  shortlisted: number;
  listingsGenerated: number;
  listingsPublished: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  details: DryRunProductResult[];
}

export interface DryRunProductResult {
  canonicalProductId: string;
  title: string;
  overallScore: number;
  riskStatus: string;
  profit: number;
  marginPercent: number;
  sellPrice: number;
  listingExternalId?: string;
  shortlisted: boolean;
}

export interface DryRunOptions {
  prisma: PrismaClient;
  connector: SourceConnector;
  marketplace: MarketplaceAdapter;
  sourceKey?: string;
  storeId: string;
  /** Minimum overall score to shortlist a candidate for listing generation. */
  scoreThreshold?: number;
}

export async function runDryRunPipeline(opts: DryRunOptions): Promise<DryRunSummary> {
  const { prisma, connector, marketplace, storeId } = opts;
  const scoreThreshold = opts.scoreThreshold ?? 40;
  const sourceKey = opts.sourceKey ?? connector.key;

  const feeSettings = await getSetting<{
    ebayFvfRate: number;
    paymentProcessingRate: number;
    paymentProcessingFlatFee: number;
    businessOverheadRate: number;
  }>(prisma, 'fee_settings');
  const scoringWeights = await getSetting(prisma, 'scoring_weights');
  const desiredMarginPercent = await getSetting<number>(prisma, 'desired_margin_percent');
  const safetyLimits = await getSetting<{
    MIN_PROFIT_AUD: number;
    MIN_MARGIN_PERCENT: number;
  }>(prisma, 'safety_limits');

  // Ensure a Source row exists for this connector.
  const source = await prisma.source.upsert({
    where: { key: sourceKey },
    create: {
      key: sourceKey,
      name: sourceKey,
      connectorType: sourceKey,
      status: 'ACTIVE',
    },
    update: {},
  });

  await marketplace.connect();

  // 1. DISCOVERY
  const discovered = await connector.discoverProducts();

  // Load existing canonical products for dedupe matching.
  const existingCanonical = await prisma.canonicalProduct.findMany();
  const candidateList: CandidateProduct[] = existingCanonical.map((c) => ({
    id: c.id,
    title: c.title,
    brand: c.brand,
    model: c.model,
    gtin: c.gtin,
  }));

  const results: DryRunProductResult[] = [];
  let listingsGenerated = 0;
  let listingsPublished = 0;
  let estimatedRevenue = 0;
  let estimatedProfit = 0;

  for (const item of discovered) {
    // 2. NORMALIZE — upsert SourceProduct
    const sourceProduct = await prisma.sourceProduct.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
      create: {
        sourceId: source.id,
        externalId: item.externalId,
        title: item.title,
        brand: item.brand,
        model: item.model,
        gtin: item.gtin,
        category: item.category,
        imageUrl: item.imageUrl,
        description: item.description,
      },
      update: {
        title: item.title,
        brand: item.brand,
        model: item.model,
        gtin: item.gtin,
        category: item.category,
        imageUrl: item.imageUrl,
        description: item.description,
      },
    });

    // 3. DEDUPE — find or create canonical product
    let canonicalId = sourceProduct.canonicalProductId;
    if (!canonicalId) {
      const matchResult = findCanonicalMatch(
        { title: item.title, brand: item.brand, model: item.model, gtin: item.gtin },
        candidateList,
      );
      if (matchResult.match) {
        canonicalId = matchResult.match.id;
      } else {
        const created = await prisma.canonicalProduct.create({
          data: {
            title: item.title,
            brand: item.brand,
            model: item.model,
            gtin: item.gtin,
            category: item.category,
            description: item.description,
            imageUrl: item.imageUrl,
          },
        });
        canonicalId = created.id;
        candidateList.push({
          id: created.id,
          title: created.title,
          brand: created.brand,
          model: created.model,
          gtin: created.gtin,
        });
      }
      await prisma.sourceProduct.update({
        where: { id: sourceProduct.id },
        data: { canonicalProductId: canonicalId },
      });
    }

    const canonicalProduct = await prisma.canonicalProduct.findUniqueOrThrow({
      where: { id: canonicalId },
    });

    // Fetch price/stock snapshots and persist.
    const priceSnap = await connector.getPrice(item.externalId);
    const stockSnap = await connector.getStock(item.externalId);

    if (priceSnap) {
      await prisma.productPrice.create({
        data: { sourceProductId: sourceProduct.id, price: priceSnap.price, currency: priceSnap.currency },
      });
    }
    if (stockSnap) {
      await prisma.productStock.create({
        data: {
          sourceProductId: sourceProduct.id,
          inStock: stockSnap.inStock,
          quantity: stockSnap.quantity,
        },
      });
    }

    if (!priceSnap || !stockSnap) continue;

    // Competitor signals (none seeded by default for fixture data — empty array is valid).
    const competitors = await prisma.competitor.findMany({ where: { canonicalProductId: canonicalId } });
    const competitorPrices = competitors.map((c) => c.price);

    // 4. RISK
    const risk = assessRisk({
      title: canonicalProduct.title,
      description: canonicalProduct.description,
      category: canonicalProduct.category,
      brand: canonicalProduct.brand,
    });
    await prisma.riskFlag.create({
      data: {
        canonicalProductId: canonicalId,
        status: risk.status,
        reasons: JSON.stringify(risk.reasons),
      },
    });

    // 5. PROFITABILITY + PRICING
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
      competitorPrices,
      priceMin: priceSnap.price * 1.05,
      priceMax: priceSnap.price * 2.5,
    });
    const profitability = calculateProfitability({ ...costInputs, sellPrice: pricing.targetPrice });

    // 6. SCORING
    const stockScore = stockScoreFromQuantity(stockSnap.inStock, stockSnap.quantity);
    const competitionScore = competitionScoreFromCount(competitors.length);
    const riskScoreVal = riskScoreFromStatus(risk.status as any);
    const scoring = calculateOpportunityScore({
      demandScore: 60, // placeholder demand signal; would come from trend/search-volume integration
      trendScore: 55,
      competitionScore,
      stockScore,
      riskScore: riskScoreVal,
      shippingScore: 70,
      weights: scoringWeights as any,
    });

    await prisma.productScore.create({
      data: {
        canonicalProductId: canonicalId,
        demandScore: 60,
        trendScore: 55,
        competitionScore,
        stockScore,
        riskScore: riskScoreVal,
        shippingScore: 70,
        overallScore: scoring.overallScore,
        breakdown: JSON.stringify(scoring.breakdown),
      },
    });

    const meetsSafety =
      profitability.profit >= safetyLimits.MIN_PROFIT_AUD &&
      profitability.marginPercent >= safetyLimits.MIN_MARGIN_PERCENT;
    const shortlisted =
      risk.status !== 'BLOCKED' && scoring.overallScore >= scoreThreshold && meetsSafety;

    const resultEntry: DryRunProductResult = {
      canonicalProductId: canonicalId,
      title: canonicalProduct.title,
      overallScore: scoring.overallScore,
      riskStatus: risk.status,
      profit: profitability.profit,
      marginPercent: profitability.marginPercent,
      sellPrice: pricing.targetPrice,
      shortlisted,
    };

    if (shortlisted) {
      // 7. LISTING GENERATION
      const generated = generateListing({
        title: canonicalProduct.title,
        brand: canonicalProduct.brand,
        model: canonicalProduct.model,
        gtin: canonicalProduct.gtin,
        category: canonicalProduct.category,
        description: canonicalProduct.description,
        imageUrl: canonicalProduct.imageUrl,
      });
      listingsGenerated++;

      const draft = await prisma.listingDraft.create({
        data: {
          canonicalProductId: canonicalId,
          title: generated.title,
          description: generated.description,
          itemSpecifics: JSON.stringify(generated.itemSpecifics),
          priceTarget: pricing.targetPrice,
          priceMin: pricing.priceMin,
          priceMax: pricing.priceMax,
          status: 'APPROVED',
          riskStatus: risk.status,
          riskReasons: JSON.stringify(risk.reasons),
        },
      });

      // 8. VALIDATE + 9. PUBLISH via MockEbayAdapter (dry-run only)
      const marketplaceListing = await marketplace.createListing({
        sku: sourceProduct.externalId,
        title: generated.title,
        description: generated.description,
        itemSpecifics: generated.itemSpecifics,
        price: pricing.targetPrice,
        quantity: stockSnap.quantity ?? 1,
        imageUrls: canonicalProduct.imageUrl ? [canonicalProduct.imageUrl] : [],
      });
      listingsPublished++;

      await prisma.listing.create({
        data: {
          listingDraftId: draft.id,
          storeId,
          externalId: marketplaceListing.externalId,
          status: 'ACTIVE',
          currentPrice: pricing.targetPrice,
          quantity: stockSnap.quantity ?? 1,
        },
      });

      resultEntry.listingExternalId = marketplaceListing.externalId;
      estimatedRevenue += pricing.targetPrice;
      estimatedProfit += profitability.profit;
    }

    results.push(resultEntry);
  }

  return {
    candidatesFound: discovered.length,
    shortlisted: results.filter((r) => r.shortlisted).length,
    listingsGenerated,
    listingsPublished,
    estimatedRevenue: Math.round(estimatedRevenue * 100) / 100,
    estimatedProfit: Math.round(estimatedProfit * 100) / 100,
    details: results,
  };
}
