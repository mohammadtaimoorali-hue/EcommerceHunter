// Worker process: runs the DB-backed queue's polling loop and the node-cron
// scheduler. Run alongside (or instead of, for this single-process demo) the
// API server via `npm run worker`.
import 'dotenv/config';
import { getPrisma } from './lib/prisma';
import { ensureDefaultSettings } from './lib/settings';
import { startScheduler } from './scheduler';
import { Queue } from './queue/Queue';
import { makePublishHandler } from './queue/publishHandler';
import { MockEbayAdapter } from './marketplace/mockEbay';

const POLL_INTERVAL_MS = Number(process.env.QUEUE_POLL_INTERVAL_MS) || 5000;

async function main() {
  const prisma = getPrisma();
  await ensureDefaultSettings(prisma);

  const marketplace = new MockEbayAdapter();
  const queue = new Queue(prisma);
  queue.register('PUBLISH_LISTING', makePublishHandler(prisma, marketplace));

  startScheduler(prisma);

  setInterval(() => {
    queue.processPending().catch((err) => console.error('Queue processing error', err));
  }, POLL_INTERVAL_MS);

  console.log(`Worker started. Polling queue every ${POLL_INTERVAL_MS}ms.`);
}

main().catch((err) => {
  console.error('Fatal error starting worker', err);
  process.exit(1);
});
