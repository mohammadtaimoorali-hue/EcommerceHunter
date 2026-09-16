import { describe, it, expect } from 'vitest';
import { KmartConnector, BigWConnector, TargetConnector, AmazonAuConnector, CatchConnector } from '../src/connectors/stubs';

describe('stub connectors', () => {
  const connectors = [
    new KmartConnector(),
    new BigWConnector(),
    new TargetConnector(),
    new AmazonAuConnector(),
    new CatchConnector(),
  ];

  it('all report UNAVAILABLE health status with a clear reason', async () => {
    for (const c of connectors) {
      const health = await c.healthCheck();
      expect(health.status).toBe('UNAVAILABLE');
      if (health.status === 'UNAVAILABLE') {
        expect(health.reason).toMatch(/no public product api|scraping/i);
      }
    }
  });

  it('all implement the full SourceConnector interface returning empty results', async () => {
    for (const c of connectors) {
      expect(await c.discoverProducts()).toEqual([]);
      expect(await c.getProduct('x')).toBeNull();
      expect(await c.getPrice('x')).toBeNull();
      expect(await c.getStock('x')).toBeNull();
      expect(await c.getVariants('x')).toEqual([]);
      expect(await c.getImages('x')).toEqual([]);
    }
  });
});
