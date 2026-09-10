import { date, integer, pgTable, timestamp } from 'drizzle-orm/pg-core';

/**
 * Atomically reserves the global Mailketing broadcast allowance for a WIB day.
 * The counter is intentionally separate from in-memory campaigns so serverless
 * instances and parallel campaigns cannot bypass the daily limit.
 */
export const emailBroadcastDailyUsage = pgTable('email_broadcast_daily_usage', {
  usageDate: date('usage_date', { mode: 'string' }).primaryKey(),
  dispatchCount: integer('dispatch_count').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
