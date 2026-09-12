import { date, integer, pgTable, timestamp, text, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import { appUsers } from './identity';

/**
 * Atomically reserves the global Mailketing broadcast allowance for a WIB day.
 * The counter is intentionally separate from campaigns so serverless
 * instances and parallel campaigns cannot bypass the daily limit.
 */
export const emailBroadcastDailyUsage = pgTable('email_broadcast_daily_usage', {
  usageDate: date('usage_date', { mode: 'string' }).primaryKey(),
  dispatchCount: integer('dispatch_count').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export interface DripRecipient {
  personId: string;
  fullName: string;
  email: string;
  gender: 'ikhwan' | 'akhwat' | null;
  cityRegency: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string | null;
  dayNumber?: number | null;
  error?: string | null;
}

export interface DripCampaignStats {
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  remaining: number;
  dailySentToday: number;
}

/**
 * Persistent storage for Drip Email Campaigns and recipient states.
 * Ensures campaigns and warm-up queues persist across serverless instances and cold starts.
 */
export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    dailyQuota: integer('daily_quota').default(50).notNull(),
    totalDays: integer('total_days').default(14).notNull(),
    currentDay: integer('current_day').default(1).notNull(),
    status: text('status').default('running').notNull(),
    filterGender: text('filter_gender').default('all').notNull(),
    stats: jsonb('stats').$type<DripCampaignStats>().notNull(),
    recipients: jsonb('recipients').$type<DripRecipient[]>().notNull(),
    lastDispatchedAt: timestamp('last_dispatched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by').references(() => appUsers.id),
  },
  (t) => ({
    statusIdx: index('idx_email_campaigns_status').on(t.status),
    createdAtIdx: index('idx_email_campaigns_created_at').on(t.createdAt),
  })
);
