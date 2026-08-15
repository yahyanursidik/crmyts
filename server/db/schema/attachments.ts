import { pgTable, uuid, text, timestamp, bigint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { appUsers } from './identity';

/**
 * 21. Attachments Table (Private File Upload Metadata)
 */
export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  storageProvider: text('storage_provider').default('s3_private').notNull(),
  bucket: text('bucket').notNull(),
  objectKey: text('object_key').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: bigint('file_size', { mode: 'bigint' }).notNull(),
  checksum: text('checksum'),
  sensitivityLevel: text('sensitivity_level').default('standard').notNull(),
  uploadedBy: uuid('uploaded_by')
    .references(() => appUsers.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Relations
export const attachmentsRelations = relations(attachments, ({ one }) => ({
  uploader: one(appUsers, {
    fields: [attachments.uploadedBy],
    references: [appUsers.id],
  }),
}));
