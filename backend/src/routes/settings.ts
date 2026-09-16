import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { DEFAULT_SETTINGS, getSetting, setSetting, ensureDefaultSettings } from '../lib/settings';

export function settingsRoutes(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    await ensureDefaultSettings(prisma);
    const rows = await prisma.setting.findMany();
    const result: Record<string, unknown> = {};
    for (const row of rows) result[row.key] = JSON.parse(row.value);
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (!(key in result)) result[key] = DEFAULT_SETTINGS[key];
    }
    res.json(result);
  });

  router.get('/:key', async (req, res) => {
    const value = await getSetting(prisma, req.params.key);
    res.json({ key: req.params.key, value });
  });

  router.put('/:key', async (req, res) => {
    await setSetting(prisma, req.params.key, req.body?.value);
    res.json({ key: req.params.key, value: req.body?.value });
  });

  return router;
}
