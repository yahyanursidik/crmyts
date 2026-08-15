import { pgTable, uuid, text, boolean, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { appUsers } from './identity';
import { genderEnum, engagementStatusEnum, preferredChannelEnum, donorPipelineStageEnum } from './enums';

/**
 * 6. Persons (Jamaah / Donatur / Waqif Master Table)
 */
export const persons = pgTable(
  'persons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fullName: text('full_name').notNull(),
    phoneE164: text('phone_e164'),
    email: text('email'),
    gender: genderEnum('gender'),
    countryCode: text('country_code').default('ID').notNull(),
    province: text('province'),
    cityRegency: text('city_regency'),
    district: text('district'),
    occupation: text('occupation'),
    educationLevel: text('education_level'),
    sourceCode: text('source_code'),
    engagementStatus: engagementStatusEnum('engagement_status').default('baru').notNull(),
    donorStage: donorPipelineStageEnum('donor_stage').default('new_lead').notNull(),
    preferredChannel: preferredChannelEnum('preferred_channel').default('whatsapp').notNull(),
    ownerUserId: uuid('owner_user_id').references(() => appUsers.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phoneIdx: index('idx_persons_phone').on(t.phoneE164),
    ownerIdx: index('idx_persons_owner').on(t.ownerUserId),
    engagementIdx: index('idx_persons_engagement').on(t.engagementStatus),
    donorStageIdx: index('idx_persons_donor_stage').on(t.donorStage),
    nameIdx: index('idx_persons_name').on(t.fullName),
  })
);

/**
 * 7. Person Roles (e.g. jamaah, donor, waqif, volunteer)
 */
export const personRoles = pgTable(
  'person_roles',
  {
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    roleCode: text('role_code').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.personId, t.roleCode] }),
  })
);

/**
 * 8. Tags Table
 */
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').unique().notNull(),
  category: text('category').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 9. Person Tags Junction Table
 */
export const personTags = pgTable(
  'person_tags',
  {
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.personId, t.tagId] }),
  })
);

/**
 * 10. Sensitive Notes Table
 * Controlled notes with permission sensitive_notes.view requirement
 */
export const sensitiveNotes = pgTable('sensitive_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id')
    .references(() => persons.id, { onDelete: 'cascade' })
    .notNull(),
  noteText: text('note_text').notNull(),
  sensitivityLevel: text('sensitivity_level').default('high').notNull(),
  reason: text('reason').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdBy: uuid('created_by')
    .references(() => appUsers.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/**
 * 10b. Donor Stage History (Audit of Donor Lifecycle Progression)
 */
export const donorStageHistory = pgTable(
  'donor_stage_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    fromStage: donorPipelineStageEnum('from_stage'),
    toStage: donorPipelineStageEnum('to_stage').notNull(),
    reason: text('reason'),
    changedBy: uuid('changed_by')
      .references(() => appUsers.id)
      .notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    personIdx: index('idx_donor_stage_hist_person').on(t.personId),
  })
);

// Relations
export const personsRelations = relations(persons, ({ one, many }) => ({
  owner: one(appUsers, {
    fields: [persons.ownerUserId],
    references: [appUsers.id],
  }),
  roles: many(personRoles),
  tags: many(personTags),
  sensitiveNotes: many(sensitiveNotes),
  stageHistories: many(donorStageHistory),
}));

export const donorStageHistoryRelations = relations(donorStageHistory, ({ one }) => ({
  person: one(persons, {
    fields: [donorStageHistory.personId],
    references: [persons.id],
  }),
  changer: one(appUsers, {
    fields: [donorStageHistory.changedBy],
    references: [appUsers.id],
  }),
}));

export const personRolesRelations = relations(personRoles, ({ one }) => ({
  person: one(persons, {
    fields: [personRoles.personId],
    references: [persons.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  personTags: many(personTags),
}));

export const personTagsRelations = relations(personTags, ({ one }) => ({
  person: one(persons, {
    fields: [personTags.personId],
    references: [persons.id],
  }),
  tag: one(tags, {
    fields: [personTags.tagId],
    references: [tags.id],
  }),
}));

export const sensitiveNotesRelations = relations(sensitiveNotes, ({ one }) => ({
  person: one(persons, {
    fields: [sensitiveNotes.personId],
    references: [persons.id],
  }),
  creator: one(appUsers, {
    fields: [sensitiveNotes.createdBy],
    references: [appUsers.id],
  }),
}));
