import { sql } from 'drizzle-orm';
import { getServerEnv } from '../config/env';
import { getDb } from '../db/client';

type SqlExecutor = Pick<ReturnType<typeof getDb>, 'execute'>;

export interface BroadcastDailyQuota {
  usageDate: string;
  dailyLimit: number;
  dispatchedToday: number;
  remainingToday: number;
}

function rowsFrom(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows)) {
    return result.rows as Array<Record<string, unknown>>;
  }
  return [];
}

export function getJakartaDateKey(now = new Date()): string {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => values.find((part) => part.type === type)?.value;
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`;
}

function toNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

/** Returns the global broadcast usage for the current WIB calendar day. */
export async function getBroadcastDailyQuota(db: SqlExecutor = getDb()): Promise<BroadcastDailyQuota> {
  const usageDate = getJakartaDateKey();
  const dailyLimit = getServerEnv().MAILKETING_BROADCAST_DAILY_LIMIT;
  const result = await db.execute(sql`
    SELECT dispatch_count
    FROM email_broadcast_daily_usage
    WHERE usage_date = ${usageDate}::date
  `);
  const dispatchedToday = Math.min(dailyLimit, toNonNegativeInteger(rowsFrom(result)[0]?.dispatch_count));

  return {
    usageDate,
    dailyLimit,
    dispatchedToday,
    remainingToday: Math.max(0, dailyLimit - dispatchedToday),
  };
}

/**
 * Atomically reserves one outbound broadcast attempt. Failed or timed-out
 * requests remain counted to avoid accidental duplicate delivery after a retry.
 */
export async function reserveBroadcastEmailSlot(db: SqlExecutor = getDb()): Promise<BroadcastDailyQuota | null> {
  const usageDate = getJakartaDateKey();
  const dailyLimit = getServerEnv().MAILKETING_BROADCAST_DAILY_LIMIT;
  const result = await db.execute(sql`
    INSERT INTO email_broadcast_daily_usage (usage_date, dispatch_count, updated_at)
    VALUES (${usageDate}::date, 1, now())
    ON CONFLICT (usage_date)
    DO UPDATE SET
      dispatch_count = email_broadcast_daily_usage.dispatch_count + 1,
      updated_at = now()
    WHERE email_broadcast_daily_usage.dispatch_count < ${dailyLimit}
    RETURNING dispatch_count
  `);
  const row = rowsFrom(result)[0];
  if (!row) return null;

  const dispatchedToday = Math.min(dailyLimit, toNonNegativeInteger(row.dispatch_count));
  return {
    usageDate,
    dailyLimit,
    dispatchedToday,
    remainingToday: Math.max(0, dailyLimit - dispatchedToday),
  };
}
