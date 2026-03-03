import { Redis } from '@upstash/redis';
import { REDIS_KEYS } from './constants';
import type { DailyCostRecord, DailyUsageRecord, CreditBalance } from './types';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error('Upstash Redis credentials not configured');
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

export async function storeDailyCost(record: DailyCostRecord): Promise<void> {
  const r = getRedis();
  await r.hset(REDIS_KEYS.DAILY_COSTS, { [record.date]: JSON.stringify(record) });
}

export async function storeDailyUsage(record: DailyUsageRecord): Promise<void> {
  const r = getRedis();
  await r.hset(REDIS_KEYS.DAILY_USAGE, { [record.date]: JSON.stringify(record) });
}

export async function storeCreditBalance(balance: CreditBalance): Promise<void> {
  const r = getRedis();
  await r.set(REDIS_KEYS.CREDIT_BALANCE, JSON.stringify(balance));
}

export async function getDailyCosts(startDate?: string, endDate?: string): Promise<DailyCostRecord[]> {
  const r = getRedis();
  const all = await r.hgetall(REDIS_KEYS.DAILY_COSTS);
  if (!all) return [];

  const records: DailyCostRecord[] = Object.values(all).map((v) =>
    typeof v === 'string' ? JSON.parse(v) : v
  );

  return records
    .filter((rec) => {
      if (startDate && rec.date < startDate) return false;
      if (endDate && rec.date > endDate) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDailyUsage(startDate?: string, endDate?: string): Promise<DailyUsageRecord[]> {
  const r = getRedis();
  const all = await r.hgetall(REDIS_KEYS.DAILY_USAGE);
  if (!all) return [];

  const records: DailyUsageRecord[] = Object.values(all).map((v) =>
    typeof v === 'string' ? JSON.parse(v) : v
  );

  return records
    .filter((rec) => {
      if (startDate && rec.date < startDate) return false;
      if (endDate && rec.date > endDate) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCreditBalance(): Promise<CreditBalance | null> {
  const r = getRedis();
  const data = await r.get(REDIS_KEYS.CREDIT_BALANCE);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data as CreditBalance;
}

export async function getLastSync(): Promise<string | null> {
  const r = getRedis();
  return r.get<string>(REDIS_KEYS.LAST_SYNC);
}

export async function setLastSync(timestamp: string): Promise<void> {
  const r = getRedis();
  await r.set(REDIS_KEYS.LAST_SYNC, timestamp);
}

export async function getAlertThresholds() {
  const r = getRedis();
  const data = await r.get(REDIS_KEYS.ALERT_THRESHOLDS);
  if (!data) return [];
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function setAlertThresholds(thresholds: unknown) {
  const r = getRedis();
  await r.set(REDIS_KEYS.ALERT_THRESHOLDS, JSON.stringify(thresholds));
}

export async function clearAllData(): Promise<void> {
  const r = getRedis();
  await Promise.all([
    r.del(REDIS_KEYS.DAILY_COSTS),
    r.del(REDIS_KEYS.DAILY_USAGE),
    r.del(REDIS_KEYS.CREDIT_BALANCE),
    r.del(REDIS_KEYS.LAST_SYNC),
  ]);
}
