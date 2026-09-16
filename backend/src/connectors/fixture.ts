import fs from 'fs';
import path from 'path';
import type {
  SourceConnector,
  DiscoveredProduct,
  PriceSnapshot,
  StockSnapshot,
  VariantInfo,
  HealthStatus,
} from './base';

interface FixtureProduct {
  externalId: string;
  title: string;
  brand: string | null;
  model: string | null;
  gtin: string | null;
  category: string | null;
  basePrice: number;
  shippingCost: number;
  baseStockQty: number;
  imageUrl: string | null;
  description: string | null;
}

/**
 * Deterministic pseudo-random number in [0, 1) derived from a seed string and
 * a call counter. Used to simulate price/stock drift without real randomness
 * so tests are reproducible. Simple mulberry32-style hash, not cryptographic.
 */
function seededRandom(seed: string, counter: number): number {
  let h = 1779033703 ^ seed.length;
  const input = `${seed}:${counter}`;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * FixtureConnector reads a static local JSON catalog and simulates price and
 * stock drift over time based on a deterministic seed + call counter (rather
 * than wall-clock randomness), so repeated calls change but tests stay
 * reproducible given the same call sequence. This is the connector the
 * FixtureConnector-based integration/e2e tests exercise; it never makes
 * network calls.
 */
export class FixtureConnector implements SourceConnector {
  readonly key = 'fixture';
  private products: FixtureProduct[];
  private callCounters: Map<string, number> = new Map();
  private forcedOutOfStock: Set<string> = new Set();

  constructor(fixturePath?: string) {
    const resolved =
      fixturePath ?? path.join(__dirname, '..', '..', 'fixtures', 'sample-products.json');
    const raw = fs.readFileSync(resolved, 'utf-8');
    this.products = JSON.parse(raw);
  }

  private nextCounter(externalId: string, kind: string): number {
    const key = `${kind}:${externalId}`;
    const current = this.callCounters.get(key) ?? 0;
    this.callCounters.set(key, current + 1);
    return current;
  }

  private find(externalId: string): FixtureProduct | undefined {
    return this.products.find((p) => p.externalId === externalId);
  }

  async discoverProducts(): Promise<DiscoveredProduct[]> {
    return this.products.map((p) => ({
      externalId: p.externalId,
      title: p.title,
      brand: p.brand,
      model: p.model,
      gtin: p.gtin,
      category: p.category,
      imageUrl: p.imageUrl,
      description: p.description,
    }));
  }

  async getProduct(externalId: string): Promise<DiscoveredProduct | null> {
    const p = this.find(externalId);
    if (!p) return null;
    return {
      externalId: p.externalId,
      title: p.title,
      brand: p.brand,
      model: p.model,
      gtin: p.gtin,
      category: p.category,
      imageUrl: p.imageUrl,
      description: p.description,
    };
  }

  async getPrice(externalId: string): Promise<PriceSnapshot | null> {
    const p = this.find(externalId);
    if (!p) return null;
    const counter = this.nextCounter(externalId, 'price');
    // Drift +/-8% around basePrice, deterministic per call.
    const r = seededRandom(externalId, counter);
    const driftPct = (r - 0.5) * 0.16;
    const price = Math.max(1, Math.round(p.basePrice * (1 + driftPct) * 100) / 100);
    return { externalId, price, currency: 'AUD' };
  }

  async getStock(externalId: string): Promise<StockSnapshot | null> {
    const p = this.find(externalId);
    if (!p) return null;
    if (this.forcedOutOfStock.has(externalId)) {
      return { externalId, inStock: false, quantity: 0 };
    }
    const counter = this.nextCounter(externalId, 'stock');
    const r = seededRandom(externalId + ':stock', counter);
    // Small chance of going out of stock, otherwise fluctuate quantity.
    const outOfStock = r < 0.03;
    if (outOfStock) {
      return { externalId, inStock: false, quantity: 0 };
    }
    const qtyDriftPct = (r - 0.5) * 0.4;
    const quantity = Math.max(0, Math.round(p.baseStockQty * (1 + qtyDriftPct)));
    return { externalId, inStock: quantity > 0, quantity };
  }

  async getVariants(externalId: string): Promise<VariantInfo[]> {
    const p = this.find(externalId);
    if (!p) return [];
    // Fixture catalog is single-variant per product for simplicity.
    return [{ sku: p.externalId, attributes: {} }];
  }

  async getImages(externalId: string): Promise<string[]> {
    const p = this.find(externalId);
    if (!p || !p.imageUrl) return [];
    return [p.imageUrl];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'OK' };
  }

  /** Test/dev helper to force a product out of stock regardless of drift. */
  forceOutOfStock(externalId: string): void {
    this.forcedOutOfStock.add(externalId);
  }
}
