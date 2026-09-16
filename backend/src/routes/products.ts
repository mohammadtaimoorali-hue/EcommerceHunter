import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';

export function productsRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/products — Product Hunter list, with latest score + risk + filters.
  router.get('/', async (req, res) => {
    const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    const products = await prisma.canonicalProduct.findMany({
      where: category ? { category } : undefined,
      include: {
        scores: { orderBy: { computedAt: 'desc' }, take: 1 },
        riskFlags: { orderBy: { createdAt: 'desc' }, take: 1 },
        sourceProducts: {
          include: {
            prices: { orderBy: { capturedAt: 'desc' }, take: 1 },
            stocks: { orderBy: { capturedAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const shaped = products
      .map((p) => ({
        id: p.id,
        title: p.title,
        brand: p.brand,
        model: p.model,
        category: p.category,
        imageUrl: p.imageUrl,
        latestScore: p.scores[0]?.overallScore ?? null,
        riskStatus: p.riskFlags[0]?.status ?? null,
        latestPrice: p.sourceProducts[0]?.prices[0]?.price ?? null,
        latestStock: p.sourceProducts[0]?.stocks[0] ?? null,
      }))
      .filter((p) => (minScore != null ? (p.latestScore ?? 0) >= minScore : true));

    res.json(shaped);
  });

  router.get('/:id', async (req, res) => {
    const product = await prisma.canonicalProduct.findUnique({
      where: { id: req.params.id },
      include: {
        scores: { orderBy: { computedAt: 'desc' }, take: 5 },
        riskFlags: { orderBy: { createdAt: 'desc' }, take: 5 },
        listingDrafts: true,
        sourceProducts: { include: { prices: true, stocks: true } },
      },
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  });

  return router;
}
