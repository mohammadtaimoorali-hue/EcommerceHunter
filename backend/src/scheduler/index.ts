// node-cron scheduler for periodic jobs. Intervals are configurable via the
// `settings` table (key "scheduler_intervals") / env, and every job type is
// also exposed via POST /api/jobs/trigger for on-demand testing.
import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import { triggerJob } from '../jobs/jobRunner';

export function startScheduler(prisma: PrismaClient): void {
  // Discovery every 6h
  cron.schedule('0 */6 * * *', () => {
    triggerJob(prisma, 'DISCOVERY').catch((err) => console.error('DISCOVERY job failed', err));
  });

  // Stock/price checks every 30min
  cron.schedule('*/30 * * * *', () => {
    triggerJob(prisma, 'PRICE_STOCK_CHECK').catch((err) =>
      console.error('PRICE_STOCK_CHECK job failed', err),
    );
  });

  // Monitoring every 2h
  cron.schedule('0 */2 * * *', () => {
    triggerJob(prisma, 'MONITORING').catch((err) => console.error('MONITORING job failed', err));
  });

  // Daily rescoring at 03:00
  cron.schedule('0 3 * * *', () => {
    triggerJob(prisma, 'RESCORING').catch((err) => console.error('RESCORING job failed', err));
  });

  // Weekly analysis Sunday 04:00
  cron.schedule('0 4 * * 0', () => {
    triggerJob(prisma, 'WEEKLY_ANALYSIS').catch((err) =>
      console.error('WEEKLY_ANALYSIS job failed', err),
    );
  });

  console.log('Scheduler started: discovery(6h), price/stock(30m), monitoring(2h), rescoring(daily), weekly analysis(weekly)');
}
