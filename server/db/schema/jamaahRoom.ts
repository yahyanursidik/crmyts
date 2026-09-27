import { pgTable, uuid, text, timestamp, boolean, index, integer } from 'drizzle-orm/pg-core';
import { events } from './events';
import { appUsers } from './identity';

export const jamaahRoomEntries = pgTable('jamaah_room_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: text('category').notNull(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  wantsReply: boolean('wants_reply').default(false).notNull(),
  publicationConsent: boolean('publication_consent').default(false).notNull(),
  anonymousPublication: boolean('anonymous_publication').default(true).notNull(),
  status: text('status').default('new').notNull(),
  internalNote: text('internal_note'),
  response: text('response'),
  publicTitle: text('public_title'),
  publicText: text('public_text'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  updatedBy: uuid('updated_by').references(() => appUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  createdIdx: index('idx_jamaah_room_created').on(t.createdAt),
  statusIdx: index('idx_jamaah_room_status').on(t.status),
  publishedIdx: index('idx_jamaah_room_published').on(t.publishedAt),
}));

export const jamaahRoomRateLimits = pgTable('jamaah_room_rate_limits', {
  key: text('key').primaryKey(),
  hits: integer('hits').default(1).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
