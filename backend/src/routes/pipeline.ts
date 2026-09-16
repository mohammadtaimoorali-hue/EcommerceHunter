import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { FixtureConnector } from '../connectors/fixture';
import { MockEbayAdapter } from '../marketplace/mockEbay';
import { runDryRunPipeline } from '../pipeline/dryRun';

export function pipelineRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/pipeline/dry-run — runs the FULL pipeline against
  // FixtureConnector + MockEbayAdapter and returns a summary. Never touches
  // the real EbayAdapter.
  router.post('/dry-run', async (req, res) => {
    try {
      let store = await prisma.store.findFirst({ where: { platform: 'ebay' } });
      if (!store) {
        store = await prisma.store.create({
          data: { name: 'Default eBay Store (dry-run)', platform: 'ebay' },
        });
      }
      const connector = new FixtureConnector();
      const marketplace = new MockEbayAdapter();
      const summary = await runDryRunPipeline({
        prisma,
        connector,
        marketplace,
        storeId: store.id,
        scoreThreshold: req.body?.scoreThreshold,
      });
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message ?? err) });
    }
  });

  return router;
}
