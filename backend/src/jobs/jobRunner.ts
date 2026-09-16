// Named job types the scheduler/admin API can trigger. Each runner records a
// JobRun (start/finish/status/result) for observability.
import type { PrismaClient } from '@prisma/client';
import { FixtureConnector } from '../connectors/fixture';
import { MockEbayAdapter } from '../marketplace/mockEbay';
import { runDryRunPipeline } from '../pipeline/dryRun';

export const JOB_TYPES = [
  'DISCOVERY',
  'PRICE_STOCK_CHECK',
  'MONITORING',
  'RESCORING',
  'WEEKLY_ANALYSIS',
  'PUBLISH_QUEUE',
] as const;
export type JobType = (typeof JOB_TYPES)[number];

// Shared fixture connector + mock adapter instance for the demo/dev
// environment. In a multi-tenant/production build these would be resolved
// per-store from `sources` / `api_credentials`.
let sharedConnector: FixtureConnector | null = null;
let sharedMarketplace: MockEbayAdapter | null = null;

function getSharedConnector(): FixtureConnector {
  if (!sharedConnector) sharedConnector = new FixtureConnector();
  return sharedConnector;
}

function getSharedMarketplace(): MockEbayAdapter {
  if (!sharedMarketplace) sharedMarketplace = new MockEbayAdapter();
  return sharedMarketplace;
}

async function getOrCreateDefaultStore(prisma: PrismaClient) {
  const existing = await prisma.store.findFirst({ where: { platform: 'ebay' } });
  if (existing) return existing;
  return prisma.store.create({ data: { name: 'Default eBay Store (dry-run)', platform: 'ebay' } });
}

export async function runJob(prisma: PrismaClient, type: JobType, payload?: any): Promise<any> {
  switch (type) {
    case 'DISCOVERY':
    case 'PRICE_STOCK_CHECK':
    case 'MONITORING':
    case 'RESCORING':
    case 'WEEKLY_ANALYSIS': {
      // For this build, all of these trigger the same dry-run pipeline
      // slice against the FixtureConnector (the only real, working
      // connector) — discovery re-normalizes/rescoes, and price/stock
      // checks refresh price+stock snapshots as a side effect of running
      // discovery again. A production build would split these into
      // dedicated, narrower runners per source.
      const store = await getOrCreateDefaultStore(prisma);
      const summary = await runDryRunPipeline({
        prisma,
        connector: getSharedConnector(),
        marketplace: getSharedMarketplace(),
        storeId: store.id,
      });
      return summary;
    }
    case 'PUBLISH_QUEUE': {
      const store = await getOrCreateDefaultStore(prisma);
      const marketplace = getSharedMarketplace();
      await marketplace.connect();
      const listings = await marketplace.getListings();
      return { storeId: store.id, activeListings: listings.length };
    }
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

export async function triggerJob(prisma: PrismaClient, type: JobType, payload?: any) {
  const job = await prisma.job.create({
    data: { type, status: 'RUNNING', payload: JSON.stringify(payload ?? {}) },
  });
  const run = await prisma.jobRun.create({ data: { jobId: job.id, status: 'RUNNING' } });
  try {
    const result = await runJob(prisma, type, payload);
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'COMPLETED', finishedAt: new Date(), result: JSON.stringify(result) },
    });
    await prisma.job.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
    return { jobId: job.id, runId: run.id, result };
  } catch (err: any) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', finishedAt: new Date(), error: String(err?.message ?? err) },
    });
    await prisma.job.update({ where: { id: job.id }, data: { status: 'FAILED' } });
    throw err;
  }
}
