import { describe, it, expect, beforeEach } from 'vitest';
import { MockEbayAdapter } from '../src/marketplace/mockEbay';

describe('MockEbayAdapter', () => {
  let adapter: MockEbayAdapter;

  beforeEach(async () => {
    adapter = new MockEbayAdapter();
    await adapter.connect();
  });

  it('validates as connected after connect()', async () => {
    const status = await adapter.validate();
    expect(status.connected).toBe(true);
  });

  it('creates, updates, and ends a listing', async () => {
    const listing = await adapter.createListing({
      sku: 'SKU-1',
      title: 'Test Item',
      description: 'desc',
      itemSpecifics: {},
      price: 100,
      quantity: 5,
      imageUrls: [],
    });
    expect(listing.status).toBe('ACTIVE');

    await adapter.updatePrice(listing.externalId, 120);
    const listings = await adapter.getListings();
    expect(listings[0].price).toBe(120);

    await adapter.endListing(listing.externalId);
    const after = await adapter.getListings();
    expect(after[0].status).toBe('ENDED');
  });

  it('pauses inventory-zero listings and resumes on restock', async () => {
    const listing = await adapter.createListing({
      sku: 'SKU-2',
      title: 'Test Item 2',
      description: 'desc',
      itemSpecifics: {},
      price: 50,
      quantity: 3,
      imageUrls: [],
    });
    await adapter.updateInventory(listing.externalId, 0);
    let listings = await adapter.getListings();
    expect(listings[0].status).toBe('PAUSED');

    await adapter.updateInventory(listing.externalId, 5);
    listings = await adapter.getListings();
    expect(listings[0].status).toBe('ACTIVE');
  });
});
