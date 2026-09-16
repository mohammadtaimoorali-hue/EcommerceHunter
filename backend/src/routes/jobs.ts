import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { JOB_TYPES, triggerJob, JobType } from '../jobs/jobRunner';

export function jobsRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/jobs — list job types and recent runs, for the admin UI.
  router.get('/', async (_req, res) => {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { runs: { orderBy: { startedAt: 'desc' }, take: 1 } },
    });
    res.json({ jobTypes: JOB_TYPES, jobs });
  });

  // POST /api/jobs/trigger { type } — trigger a job on demand for testing.
  router.post('/trigger', async (req, res) => {
    const type = req.body?.type as JobType;
    if (!type || !JOB_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${JOB_TYPES.join(', ')}` });
    }
    try {
      const result = await triggerJob(prisma, type, req.body?.payload);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message ?? err) });
    }
  });

  return router;
}
