import { pgTable, uuid, text, boolean, timestamp, bigint, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { appUsers } from './identity';
import { persons } from './people';
import { waqfStageEnum, waqfTypeEnum } from './enums';

/**
 * 17. Waqf Cases Table
 */
export const waqfCases = pgTable(
  'waqf_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    waqfType: waqfTypeEnum('waqf_type').notNull(),
    estimatedValueRupiah: bigint('estimated_value_rupiah', { mode: 'bigint' }),
    currentStage: waqfStageEnum('current_stage').default('interested').notNull(),
    ownerUserId: uuid('owner_user_id')
      .references(() => appUsers.id)
      .notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    nextActionAt: timestamp('next_action_at', { withTimezone: true }),
    notesSummary: text('notes_summary'),
    createdBy: uuid('created_by')
      .references(() => appUsers.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    stageIdx: index('idx_waqf_stage').on(t.currentStage),
    ownerIdx: index('idx_waqf_owner').on(t.ownerUserId),
    personIdx: index('idx_waqf_person').on(t.personId),
  })
);

/**
 * 18. Waqf Stage History Table (Audit of Stage Transitions)
 */
export const waqfStageHistory = pgTable(
  'waqf_stage_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    waqfCaseId: uuid('waqf_case_id')
      .references(() => waqfCases.id, { onDelete: 'cascade' })
      .notNull(),
    fromStage: waqfStageEnum('from_stage'),
    toStage: waqfStageEnum('to_stage').notNull(),
    reason: text('reason'),
    changedBy: uuid('changed_by')
      .references(() => appUsers.id)
      .notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    caseIdx: index('idx_waqf_stage_hist_case').on(t.waqfCaseId),
  })
);

/**
 * 19. Waqf Checklist Items Table
 */
export const waqfChecklistItems = pgTable('waqf_checklist_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  waqfCaseId: uuid('waqf_case_id')
    .references(() => waqfCases.id, { onDelete: 'cascade' })
    .notNull(),
  itemCode: text('item_code').notNull(),
  label: text('label').notNull(),
  isRequired: boolean('is_required').default(true).notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  completedBy: uuid('completed_by').references(() => appUsers.id),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/**
 * 20. Waqf Documents Table (Legal & Administrative Attachments)
 */
export const waqfDocuments = pgTable('waqf_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  waqfCaseId: uuid('waqf_case_id')
    .references(() => waqfCases.id, { onDelete: 'cascade' })
    .notNull(),
  attachmentId: uuid('attachment_id').notNull(),
  documentType: text('document_type').notNull(),
  versionNo: integer('version_no').default(1).notNull(),
  isSensitive: boolean('is_sensitive').default(true).notNull(),
  uploadedBy: uuid('uploaded_by')
    .references(() => appUsers.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const waqfCasesRelations = relations(waqfCases, ({ one, many }) => ({
  person: one(persons, {
    fields: [waqfCases.personId],
    references: [persons.id],
  }),
  owner: one(appUsers, {
    fields: [waqfCases.ownerUserId],
    references: [appUsers.id],
  }),
  stageHistories: many(waqfStageHistory),
  checklistItems: many(waqfChecklistItems),
  documents: many(waqfDocuments),
}));

export const waqfStageHistoryRelations = relations(waqfStageHistory, ({ one }) => ({
  waqfCase: one(waqfCases, {
    fields: [waqfStageHistory.waqfCaseId],
    references: [waqfCases.id],
  }),
  changer: one(appUsers, {
    fields: [waqfStageHistory.changedBy],
    references: [appUsers.id],
  }),
}));

export const waqfChecklistItemsRelations = relations(waqfChecklistItems, ({ one }) => ({
  waqfCase: one(waqfCases, {
    fields: [waqfChecklistItems.waqfCaseId],
    references: [waqfCases.id],
  }),
}));

export const waqfDocumentsRelations = relations(waqfDocuments, ({ one }) => ({
  waqfCase: one(waqfCases, {
    fields: [waqfDocuments.waqfCaseId],
    references: [waqfCases.id],
  }),
  uploader: one(appUsers, {
    fields: [waqfDocuments.uploadedBy],
    references: [appUsers.id],
  }),
}));
