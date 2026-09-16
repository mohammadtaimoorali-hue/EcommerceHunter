// SourceConnector: the plugin interface every retailer integration implements.
// Discovery/pricing/stock methods return plain DTOs so the pipeline never
// needs to know which connector produced them.

export interface DiscoveredProduct {
  externalId: string;
  title: string;
  brand?: string | null;
  model?: string | null;
  gtin?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  description?: string | null;
}

export interface PriceSnapshot {
  externalId: string;
  price: number;
  currency: string;
}

export interface StockSnapshot {
  externalId: string;
  inStock: boolean;
  quantity: number | null;
}

export interface VariantInfo {
  sku: string;
  attributes: Record<string, string>;
}

export type HealthStatus =
  | { status: 'OK' }
  | { status: 'UNAVAILABLE'; reason: string };

export interface SourceConnector {
  /** Stable key identifying this connector, e.g. "fixture", "kmart". */
  readonly key: string;

  discoverProducts(): Promise<DiscoveredProduct[]>;
  getProduct(externalId: string): Promise<DiscoveredProduct | null>;
  getPrice(externalId: string): Promise<PriceSnapshot | null>;
  getStock(externalId: string): Promise<StockSnapshot | null>;
  getVariants(externalId: string): Promise<VariantInfo[]>;
  getImages(externalId: string): Promise<string[]>;
  healthCheck(): Promise<HealthStatus>;
}
