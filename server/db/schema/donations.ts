import { pgTable, uuid, text, boolean, timestamp, bigint, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { appUsers } from './identity';
import { persons } from './people';
import { donationStatusEnum, paymentMethodEnum } from './enums';

/**
 * 15. Donation Programs Table
 */
export const donationPrograms = pgTable('donation_programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  code: text('code').unique().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 16. Donations Table
 * Financial Integrity: amount_rupiah is strictly bigint (integer Rupiah).
 */
export const donations = pgTable(
  'donations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personId: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    programId: uuid('program_id')
      .references(() => donationPrograms.id)
      .notNull(),
    donationDate: timestamp('donation_date', { withTimezone: true }).notNull(),
    amountRupiah: bigint('amount_rupiah', { mode: 'bigint' }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').default('bank_transfer').notNull(),
    externalReference: text('external_reference'),
    verificationStatus: donationStatusEnum('verification_status').default('unverified').notNull(),
    proofAttachmentId: uuid('proof_attachment_id'),
    verifiedBy: uuid('verified_by').references(() => appUsers.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    correctionOfDonationId: uuid('correction_of_donation_id'),
    createdBy: uuid('created_by')
      .references(() => appUsers.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index('idx_donations_date').on(t.donationDate),
    statusIdx: index('idx_donations_status').on(t.verificationStatus),
    personIdx: index('idx_donations_person').on(t.personId),
    programIdx: index('idx_donations_program').on(t.programId),
    refIdx: index('idx_donations_ext_ref').on(t.externalReference),
  })
);

// Relations
export const donationProgramsRelations = relations(donationPrograms, ({ many }) => ({
  donations: many(donations),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  person: one(persons, {
    fields: [donations.personId],
    references: [persons.id],
  }),
  program: one(donationPrograms, {
    fields: [donations.programId],
    references: [donationPrograms.id],
  }),
  verifier: one(appUsers, {
    fields: [donations.verifiedBy],
    references: [appUsers.id],
  }),
  creator: one(appUsers, {
    fields: [donations.createdBy],
    references: [appUsers.id],
  }),
}));
