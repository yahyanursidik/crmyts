import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { appUsers } from './identity';

/**
 * 22. Audit Logs Table
 * Append-only immutable log for sensitive, financial, and administrative operations.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => appUsers.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    beforeJson: jsonb('before_json'),
    afterJson: jsonb('after_json'),
    reason: text('reason'),
    requestId: text('request_id'),
    ipHash: text('ip_hash'),
    userAgentSummary: text('user_agent_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index('idx_audit_actor').on(t.actorUserId),
    entityIdx: index('idx_audit_entity').on(t.entityType, t.entityId),
    createdAtIdx: index('idx_audit_created_at').on(t.createdAt),
    actionIdx: index('idx_audit_action').on(t.action),
  })
);

/**
 * 23. Export Logs Table
 * Tracks all data export activities for governance and data protection.
 */
export const exportLogs = pgTable(
  'export_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id')
      .references(() => appUsers.id)
      .notNull(),
    exportType: text('export_type').notNull(),
    filterJson: jsonb('filter_json'),
    rowCount: integer('row_count').notNull(),
    reason: text('reason').notNull(),
    fileReference: text('file_reference'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index('idx_export_actor').on(t.actorUserId),
    createdAtIdx: index('idx_export_created_at').on(t.createdAt),
  })
);

// Relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(appUsers, {
    fields: [auditLogs.actorUserId],
    references: [appUsers.id],
  }),
}));

export const exportLogsRelations = relations(exportLogs, ({ one }) => ({
  actor: one(appUsers, {
    fields: [exportLogs.actorUserId],
    references: [appUsers.id],
  }),
}));
