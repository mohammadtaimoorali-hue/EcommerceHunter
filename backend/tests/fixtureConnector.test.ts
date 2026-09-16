import { describe, it, expect } from 'vitest';
import { FixtureConnector } from '../src/connectors/fixture';

describe('FixtureConnector', () => {
  it('reports healthy status', async () => {
    const connector = new FixtureConnector();
    const health = await connector.healthCheck();
    expect(health.status).toBe('OK');
  });

  it('discovers ~20 realistic AU retail products across categories', async () => {
    const connector = new FixtureConnector();
    const products = await connector.discoverProducts();
    expect(products.length).toBeGreaterThanOrEqual(15);
    const categories = new Set(products.map((p) => p.category));
    expect(categories.size).toBeGreaterThan(3);
  });

  it('simulates deterministic price drift based on seed + call count', async () => {
    const connector = new FixtureConnector();
    const first = await connector.getPrice('FX-0001');
    const second = await connector.getPrice('FX-0001');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    // Same product across two connector instances with the same call count
    // should be deterministic.
    const connectorB = new FixtureConnector();
    await connectorB.getPrice('FX-0001'); // burn one call to align counters
    const replay = await connectorB.getPrice('FX-0001');
    expect(replay!.price).toBe(second!.price);
  });

  it('can force a product out of stock for testing', async () => {
    const connector = new FixtureConnector();
    connector.forceOutOfStock('FX-0001');
    const stock = await connector.getStock('FX-0001');
    expect(stock!.inStock).toBe(false);
    expect(stock!.quantity).toBe(0);
  });
});
