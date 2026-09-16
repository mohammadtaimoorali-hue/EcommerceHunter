import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { FixtureConnector } from '../connectors/fixture';
import {
  KmartConnector,
  BigWConnector,
  TargetConnector,
  AmazonAuConnector,
  CatchConnector,
} from '../connectors/stubs';
import type { SourceConnector } from '../connectors/base';

function allConnectors(): SourceConnector[] {
  return [
    new FixtureConnector(),
    new KmartConnector(),
    new BigWConnector(),
    new TargetConnector(),
    new AmazonAuConnector(),
    new CatchConnector(),
  ];
}

export function sourcesRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/sources — Sources page: shows connector health for every
  // registered plugin (proves the architecture without touching core code).
  router.get('/', async (_req, res) => {
    const connectors = allConnectors();
    const health = await Promise.all(
      connectors.map(async (c) => ({ key: c.key, health: await c.healthCheck() })),
    );
    const dbSources = await prisma.source.findMany();
    res.json({ connectors: health, sources: dbSources });
  });

  return router;
}
