import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { appUsers } from './identity';
import { persons } from './people';
import { interactionChannelEnum, taskStatusEnum, taskPriorityEnum } from './enums';

/**
 * 13. Interactions Log Table
 */
export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    channel: interactionChannelEnum('channel').default('whatsapp').notNull(),
    summary: text('summary').notNull(),
    outcome: text('outcome'),
    sensitivityLevel: text('sensitivity_level').default('standard').notNull(),
    ownerUserId: uuid('owner_user_id').references(() => appUsers.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by')
      .references(() => appUsers.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    personIdx: index('idx_interactions_person').on(t.personId),
    occurredAtIdx: index('idx_interactions_occurred_at').on(t.occurredAt),
  })
);

/**
 * 14. Tasks / Follow-Up Table
 */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personId: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    relatedType: text('related_type'), // e.g. 'event', 'donation', 'waqf_case'
    relatedId: uuid('related_id'),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').default('pending').notNull(),
    priority: taskPriorityEnum('priority').default('medium').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    ownerUserId: uuid('owner_user_id')
      .references(() => appUsers.id)
      .notNull(),
    assignedBy: uuid('assigned_by').references(() => appUsers.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index('idx_tasks_owner').on(t.ownerUserId),
    dueAtIdx: index('idx_tasks_due_at').on(t.dueAt),
    statusIdx: index('idx_tasks_status').on(t.status),
    personIdx: index('idx_tasks_person').on(t.personId),
  })
);

// Relations
export const interactionsRelations = relations(interactions, ({ one }) => ({
  person: one(persons, {
    fields: [interactions.personId],
    references: [persons.id],
  }),
  owner: one(appUsers, {
    fields: [interactions.ownerUserId],
    references: [appUsers.id],
  }),
  creator: one(appUsers, {
    fields: [interactions.createdBy],
    references: [appUsers.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  person: one(persons, {
    fields: [tasks.personId],
    references: [persons.id],
  }),
  owner: one(appUsers, {
    fields: [tasks.ownerUserId],
    references: [appUsers.id],
  }),
  assigner: one(appUsers, {
    fields: [tasks.assignedBy],
    references: [appUsers.id],
  }),
}));
