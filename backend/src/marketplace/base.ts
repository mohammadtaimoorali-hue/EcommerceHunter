// MarketplaceAdapter: abstraction over a marketplace's listing/order API so
// the pipeline can target eBay today and other marketplaces later without
// touching core code.

export interface CreateListingInput {
  sku: string;
  title: string;
  description: string;
  itemSpecifics: Record<string, string>;
  price: number;
  quantity: number;
  imageUrls: string[];
  categoryId?: string;
}

export interface MarketplaceListing {
  externalId: string;
  sku: string;
  title: string;
  price: number;
  quantity: number;
  status: 'ACTIVE' | 'PAUSED' | 'ENDED';
}

export interface MarketplaceOrder {
  externalId: string;
  listingExternalId: string;
  quantity: number;
  salePrice: number;
  buyerName?: string;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';
}

export type ConnectionStatus =
  | { connected: true }
  | { connected: false; reason: string };

export interface MarketplaceAdapter {
  readonly name: string;

  connect(): Promise<void>;
  validate(): Promise<ConnectionStatus>;
  createListing(input: CreateListingInput): Promise<MarketplaceListing>;
  updateListing(externalId: string, input: Partial<CreateListingInput>): Promise<MarketplaceListing>;
  updateInventory(externalId: string, quantity: number): Promise<void>;
  updatePrice(externalId: string, price: number): Promise<void>;
  endListing(externalId: string): Promise<void>;
  getOrders(): Promise<MarketplaceOrder[]>;
  getListings(): Promise<MarketplaceListing[]>;
}
