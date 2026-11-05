import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  index,
  integer,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { events } from "./events";
import { appUsers } from "./identity";
import { persons } from "./people";
import { interactions, tasks } from "./interactions";

export const jamaahRoomEntries = pgTable(
  "jamaah_room_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    category: text("category").notNull(),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    ownerUserId: uuid("owner_user_id").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    responseRecordedAt: timestamp("response_recorded_at", {
      withTimezone: true,
    }),
    replyChannel: text("reply_channel"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    archiveReason: text("archive_reason"),
    submissionKey: uuid("submission_key"),
    submissionDigest: text("submission_digest"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    wantsReply: boolean("wants_reply").default(false).notNull(),
    publicationConsent: boolean("publication_consent").default(false).notNull(),
    anonymousPublication: boolean("anonymous_publication")
      .default(true)
      .notNull(),
    status: text("status").default("new").notNull(),
    internalNote: text("internal_note"),
    response: text("response"),
    publicTitle: text("public_title"),
    publicText: text("public_text"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedBy: uuid("updated_by").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    createdIdx: index("idx_jamaah_room_created").on(t.createdAt),
    statusIdx: index("idx_jamaah_room_status").on(t.status),
    publishedIdx: index("idx_jamaah_room_published").on(t.publishedAt),
    submissionIdx: uniqueIndex("idx_jamaah_room_submission").on(
      t.submissionKey,
    ),
    personIdx: index("idx_jamaah_room_person").on(t.personId),
    ownerIdx: index("idx_jamaah_room_owner").on(t.ownerUserId),
  }),
);

export const jamaahRoomActivity = pgTable(
  "jamaah_room_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .references(() => jamaahRoomEntries.id, { onDelete: "cascade" })
      .notNull(),
    actorUserId: uuid("actor_user_id").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    content: text("content"),
    details: jsonb("details"),
    interactionId: uuid("interaction_id").references(() => interactions.id, {
      onDelete: "set null",
    }),
    taskId: uuid("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    entryIdx: index("idx_jamaah_room_activity_entry").on(
      t.entryId,
      t.createdAt,
    ),
    interactionIdx: index("idx_jamaah_room_activity_interaction").on(
      t.interactionId,
    ),
  }),
);
export const jamaahRoomEntriesRelations = relations(
  jamaahRoomEntries,
  ({ one }) => ({
    person: one(persons, {
      fields: [jamaahRoomEntries.personId],
      references: [persons.id],
    }),
    owner: one(appUsers, {
      fields: [jamaahRoomEntries.ownerUserId],
      references: [appUsers.id],
    }),
    event: one(events, {
      fields: [jamaahRoomEntries.eventId],
      references: [events.id],
    }),
  }),
);
export const jamaahRoomActivityRelations = relations(
  jamaahRoomActivity,
  ({ one }) => ({
    actor: one(appUsers, {
      fields: [jamaahRoomActivity.actorUserId],
      references: [appUsers.id],
    }),
  }),
);

export const jamaahRoomRateLimits = pgTable("jamaah_room_rate_limits", {
  key: text("key").primaryKey(),
  hits: integer("hits").default(1).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
