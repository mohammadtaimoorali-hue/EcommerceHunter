// MockEbayAdapter: fully functional in-memory implementation of
// MarketplaceAdapter used by dry-run mode and all tests. It never calls the
// real eBay API.
import { randomUUID } from 'crypto';
import type {
  MarketplaceAdapter,
  CreateListingInput,
  MarketplaceListing,
  MarketplaceOrder,
  ConnectionStatus,
} from './base';

export class MockEbayAdapter implements MarketplaceAdapter {
  readonly name = 'mock-ebay';
  private listings: Map<string, MarketplaceListing> = new Map();
  private orders: MarketplaceOrder[] = [];
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async validate(): Promise<ConnectionStatus> {
    if (!this.connected) {
      return { connected: false, reason: 'Not connected. Call connect() first.' };
    }
    return { connected: true };
  }

  async createListing(input: CreateListingInput): Promise<MarketplaceListing> {
    const listing: MarketplaceListing = {
      externalId: randomUUID(),
      sku: input.sku,
      title: input.title,
      price: input.price,
      quantity: input.quantity,
      status: 'ACTIVE',
    };
    this.listings.set(listing.externalId, listing);
    return listing;
  }

  async updateListing(
    externalId: string,
    input: Partial<CreateListingInput>,
  ): Promise<MarketplaceListing> {
    const existing = this.listings.get(externalId);
    if (!existing) throw new Error(`Listing ${externalId} not found`);
    const updated: MarketplaceListing = {
      ...existing,
      title: input.title ?? existing.title,
      price: input.price ?? existing.price,
      quantity: input.quantity ?? existing.quantity,
    };
    this.listings.set(externalId, updated);
    return updated;
  }

  async updateInventory(externalId: string, quantity: number): Promise<void> {
    const existing = this.listings.get(externalId);
    if (!existing) throw new Error(`Listing ${externalId} not found`);
    existing.quantity = quantity;
    if (quantity <= 0) {
      existing.status = 'PAUSED';
    } else if (existing.status === 'PAUSED') {
      existing.status = 'ACTIVE';
    }
    this.listings.set(externalId, existing);
  }

  async updatePrice(externalId: string, price: number): Promise<void> {
    const existing = this.listings.get(externalId);
    if (!existing) throw new Error(`Listing ${externalId} not found`);
    existing.price = price;
    this.listings.set(externalId, existing);
  }

  async endListing(externalId: string): Promise<void> {
    const existing = this.listings.get(externalId);
    if (!existing) throw new Error(`Listing ${externalId} not found`);
    existing.status = 'ENDED';
    this.listings.set(externalId, existing);
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    return [...this.orders];
  }

  async getListings(): Promise<MarketplaceListing[]> {
    return Array.from(this.listings.values());
  }

  /** Test/dry-run helper to simulate a buyer order landing on a listing. */
  simulateOrder(listingExternalId: string, quantity: number, salePrice: number): MarketplaceOrder {
    const order: MarketplaceOrder = {
      externalId: randomUUID(),
      listingExternalId,
      quantity,
      salePrice,
      status: 'PENDING',
    };
    this.orders.push(order);
    return order;
  }
}
