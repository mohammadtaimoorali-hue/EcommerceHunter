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

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  operating_mode: 'ASSISTED',
  fee_settings: DEFAULT_FEE_SETTINGS,
  scoring_weights: DEFAULT_WEIGHTS,
  safety_limits: DEFAULT_SAFETY_LIMITS,
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
