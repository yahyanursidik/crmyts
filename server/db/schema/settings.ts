import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const foundationSettings = pgTable('foundation_settings', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
