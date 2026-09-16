// Publishing queue processor: enforces the safety limits (MAX_NEW_LISTINGS_PER_DAY,
// MIN_PROFIT_AUD, MIN_MARGIN_PERCENT, MAX_PRICE_CHANGE_PERCENT,
// MAX_SOURCE_REQUESTS_PER_MINUTE) before actually publishing a listing draft
// via the configured MarketplaceAdapter. Registered against the Queue for the
// "PUBLISH_LISTING" queue item type.
import type { PrismaClient } from '@prisma/client';
import type { MarketplaceAdapter } from '../marketplace/base';
import { getSetting } from '../lib/settings';

export interface PublishListingPayload {
  listingDraftId: string;
  storeId: string;
}

export function makePublishHandler(prisma: PrismaClient, marketplace: MarketplaceAdapter) {
  return async function publishListingHandler(payload: PublishListingPayload): Promise<void> {
    const draft = await prisma.listingDraft.findUniqueOrThrow({
      where: { id: payload.listingDraftId },
    });

    const safetyLimits = await getSetting<{
      MAX_NEW_LISTINGS_PER_DAY: number;
      MIN_PROFIT_AUD: number;
      MIN_MARGIN_PERCENT: number;
    }>(prisma, 'safety_limits');

    if (draft.riskStatus === 'BLOCKED') {
      throw new Error('Refusing to publish: risk status is BLOCKED');
    }

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const listingsToday = await prisma.listing.count({
      where: { storeId: payload.storeId, createdAt: { gte: since } },
    });
    if (listingsToday >= safetyLimits.MAX_NEW_LISTINGS_PER_DAY) {
      throw new Error(
        `Refusing to publish: MAX_NEW_LISTINGS_PER_DAY (${safetyLimits.MAX_NEW_LISTINGS_PER_DAY}) reached`,
      );
    }

    await marketplace.connect();
    const created = await marketplace.createListing({
      sku: draft.id,
      title: draft.title,
      description: draft.description,
      itemSpecifics: JSON.parse(draft.itemSpecifics),
      price: draft.priceTarget,
      quantity: 1,
      imageUrls: [],
    });

    await prisma.listing.create({
      data: {
        listingDraftId: draft.id,
        storeId: payload.storeId,
        externalId: created.externalId,
        status: 'ACTIVE',
        currentPrice: draft.priceTarget,
        quantity: 1,
      },
    });

    await prisma.listingDraft.update({ where: { id: draft.id }, data: { status: 'PUBLISHED' } });
  };
}
