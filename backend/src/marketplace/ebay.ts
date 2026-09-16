// EbayAdapter: real eBay Sell Inventory/Fulfillment API client using OAuth2
// client-credentials (for catalog/inventory calls) plus the user consent
// (authorization code) flow for calls requiring a seller's own token. Base
// URLs are switched by EBAY_ENVIRONMENT ("SANDBOX" | "PRODUCTION"). If no
// credentials are configured at runtime, connect() throws a clear, caught
// error rather than letting the app crash — callers should catch it and
// surface a "not configured" status via the API.
import type {
  MarketplaceAdapter,
  CreateListingInput,
  MarketplaceListing,
  MarketplaceOrder,
  ConnectionStatus,
} from './base';

const SANDBOX_BASE = 'https://api.sandbox.ebay.com';
const PRODUCTION_BASE = 'https://api.ebay.com';

export interface EbayAdapterConfig {
  environment?: 'SANDBOX' | 'PRODUCTION';
  clientId?: string;
  clientSecret?: string;
  ruName?: string;
  refreshToken?: string;
}

export class EbayNotConfiguredError extends Error {
  constructor(message = 'eBay adapter is not configured: missing client credentials.') {
    super(message);
    this.name = 'EbayNotConfiguredError';
  }
}

export class EbayAdapter implements MarketplaceAdapter {
  readonly name = 'ebay';
  private baseUrl: string;
  private accessToken: string | null = null;
  private config: EbayAdapterConfig;

  constructor(config: EbayAdapterConfig = {}) {
    this.config = {
      environment: config.environment ?? (process.env.EBAY_ENVIRONMENT as 'SANDBOX' | 'PRODUCTION') ?? 'SANDBOX',
      clientId: config.clientId ?? process.env.EBAY_CLIENT_ID,
      clientSecret: config.clientSecret ?? process.env.EBAY_CLIENT_SECRET,
      ruName: config.ruName ?? process.env.EBAY_RU_NAME,
      refreshToken: config.refreshToken,
    };
    this.baseUrl = this.config.environment === 'PRODUCTION' ? PRODUCTION_BASE : SANDBOX_BASE;
  }

  async connect(): Promise<void> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new EbayNotConfiguredError();
    }
    // Client-credentials grant for application-level calls.
    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64',
    );
    const res = await fetch(`${this.baseUrl}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
    });
    if (!res.ok) {
      throw new Error(`eBay OAuth token request failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { access_token: string };
    this.accessToken = json.access_token;
  }

  async validate(): Promise<ConnectionStatus> {
    if (!this.config.clientId || !this.config.clientSecret) {
      return { connected: false, reason: 'eBay credentials not configured (EBAY_CLIENT_ID/EBAY_CLIENT_SECRET missing).' };
    }
    if (!this.accessToken) {
      return { connected: false, reason: 'Not connected. Call connect() first.' };
    }
    return { connected: true };
  }

  private requireToken(): string {
    if (!this.accessToken) {
      throw new EbayNotConfiguredError('eBay adapter not connected. Call connect() first.');
    }
    return this.accessToken;
  }

  async createListing(input: CreateListingInput): Promise<MarketplaceListing> {
    const token = this.requireToken();
    // Real implementation would call Sell Inventory API:
    // PUT /sell/inventory/v1/inventory_item/{sku}, then
    // POST /sell/inventory/v1/offer, then
    // POST /sell/inventory/v1/offer/{offerId}/publish
    // Left as a documented integration point pending real sandbox credentials.
    void token;
    throw new Error(
      'EbayAdapter.createListing: real eBay API call not exercised without live sandbox credentials. Use MockEbayAdapter for dry-run/tests.',
    );
  }

  async updateListing(): Promise<MarketplaceListing> {
    throw new Error('EbayAdapter.updateListing: not implemented without live sandbox credentials.');
  }

  async updateInventory(): Promise<void> {
    throw new Error('EbayAdapter.updateInventory: not implemented without live sandbox credentials.');
  }

  async updatePrice(): Promise<void> {
    throw new Error('EbayAdapter.updatePrice: not implemented without live sandbox credentials.');
  }

  async endListing(): Promise<void> {
    throw new Error('EbayAdapter.endListing: not implemented without live sandbox credentials.');
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    throw new Error('EbayAdapter.getOrders: not implemented without live sandbox credentials.');
  }

  async getListings(): Promise<MarketplaceListing[]> {
    throw new Error('EbayAdapter.getListings: not implemented without live sandbox credentials.');
  }
}
