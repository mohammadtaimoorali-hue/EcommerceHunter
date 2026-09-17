import { PrismaClient } from '@prisma/client';
import { DEFAULT_FEE_SETTINGS } from '../engines/profitability';
import { DEFAULT_WEIGHTS } from '../engines/scoring';

export const DEFAULT_SAFETY_LIMITS = {
  MAX_NEW_LISTINGS_PER_DAY: 20,
  MIN_PROFIT_AUD: 10,
  MIN_MARGIN_PERCENT: 15,
  MAX_PRICE_CHANGE_PERCENT: 20,
  MAX_SOURCE_REQUESTS_PER_MINUTE: 30,
};

// Kept here (rather than in monitor/priceStockMonitor.ts) to avoid a circular
// import — the monitor imports getSetting() from this module.
export interface MonitorSettings {
  /** When a source product goes out of stock: 'PAUSE' keeps the listing (qty 0) for quick recovery, 'END' ends it outright. */
  onOutOfStock: 'PAUSE' | 'END';
  /** When a price change makes a listing no longer meet safety-limit profitability: 'PAUSE' or 'END'. */
  onUnprofitable: 'PAUSE' | 'END';
  /** Ignore retail price wobble smaller than this percent (avoids thrashing on noise). */
  minPriceChangePercent: number;
}

export const DEFAULT_MONITOR_SETTINGS: MonitorSettings = {
  onOutOfStock: 'PAUSE',
  onUnprofitable: 'PAUSE',
  minPriceChangePercent: 1,
};

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  operating_mode: 'ASSISTED',
  fee_settings: DEFAULT_FEE_SETTINGS,
  scoring_weights: DEFAULT_WEIGHTS,
  safety_limits: DEFAULT_SAFETY_LIMITS,
  monitor_settings: DEFAULT_MONITOR_SETTINGS,
  desired_margin_percent: 25,
  scheduler_intervals: {
    discovery_hours: 6,
    price_stock_minutes: 30,
    monitoring_hours: 2,
    rescoring: 'daily',
    weekly_analysis: 'weekly',
  },
};

export async function getSetting<T = unknown>(prisma: PrismaClient, key: string): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (row) return JSON.parse(row.value) as T;
  return DEFAULT_SETTINGS[key] as T;
}

export async function setSetting(prisma: PrismaClient, key: string, value: unknown): Promise<void> {
  const encoded = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: encoded },
    update: { value: encoded },
  });
}

export async function ensureDefaultSettings(prisma: PrismaClient): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (!existing) {
      await setSetting(prisma, key, value);
    }
  }
}
