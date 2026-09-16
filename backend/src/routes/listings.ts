import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';

export function listingDraftsRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/listing-drafts — Listing Queue page.
  router.get('/', async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const drafts = await prisma.listingDraft.findMany({
      where: status ? { status } : undefined,
      include: { canonicalProduct: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(drafts);
  });

  router.post('/:id/approve', async (req, res) => {
    const draft = await prisma.listingDraft.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED' },
    });
    res.json(draft);
  });

  router.post('/:id/reject', async (req, res) => {
    const draft = await prisma.listingDraft.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
    });
    res.json(draft);
  });

  return router;
}

export function listingsRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/listings — eBay Listings page.
  router.get('/', async (_req, res) => {
    const listings = await prisma.listing.findMany({
      include: { listingDraft: { include: { canonicalProduct: true } }, store: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(listings);
  });

  return router;
}
