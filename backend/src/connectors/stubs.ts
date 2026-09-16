// Stub connectors prove the SourceConnector plugin architecture extends to
// new retailers without touching core pipeline code. They intentionally do
// NOT scrape or call any undocumented API — healthCheck() reports UNAVAILABLE
// until a real public product API or affiliate feed is configured. This is a
// hard constraint: never implement CAPTCHA bypass or bot-detection evasion.
import type {
  SourceConnector,
  DiscoveredProduct,
  PriceSnapshot,
  StockSnapshot,
  VariantInfo,
  HealthStatus,
} from './base';

class UnavailableStubConnector implements SourceConnector {
  constructor(
    readonly key: string,
    private readonly displayName: string,
  ) {}

  async discoverProducts(): Promise<DiscoveredProduct[]> {
    return [];
  }

  async getProduct(_externalId: string): Promise<DiscoveredProduct | null> {
    return null;
  }

  async getPrice(_externalId: string): Promise<PriceSnapshot | null> {
    return null;
  }

  async getStock(_externalId: string): Promise<StockSnapshot | null> {
    return null;
  }

  async getVariants(_externalId: string): Promise<VariantInfo[]> {
    return [];
  }

  async getImages(_externalId: string): Promise<string[]> {
    return [];
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'UNAVAILABLE',
      reason: `No public product API / affiliate feed configured for ${this.displayName}; scraping without permission is out of scope.`,
    };
  }
}

export class KmartConnector extends UnavailableStubConnector {
  constructor() {
    super('kmart', 'Kmart Australia');
  }
}

export class BigWConnector extends UnavailableStubConnector {
  constructor() {
    super('bigw', 'Big W');
  }
}

export class TargetConnector extends UnavailableStubConnector {
  constructor() {
    super('target', 'Target Australia');
  }
}

export class AmazonAuConnector extends UnavailableStubConnector {
  constructor() {
    super('amazon_au', 'Amazon Australia');
  }
}

export class CatchConnector extends UnavailableStubConnector {
  constructor() {
    super('catch', 'Catch.com.au');
  }
}
