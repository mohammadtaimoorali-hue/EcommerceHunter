import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';

export function overviewRoutes(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const [canonicalProducts, listingDrafts, listings, sources, alerts] = await Promise.all([
      prisma.canonicalProduct.count(),
      prisma.listingDraft.count(),
      prisma.listing.count({ where: { status: 'ACTIVE' } }),
      prisma.source.count(),
      prisma.systemAlert.findMany({ where: { resolved: false }, take: 10, orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ canonicalProducts, listingDrafts, activeListings: listings, sources, alerts });
  });

  return router;
}
