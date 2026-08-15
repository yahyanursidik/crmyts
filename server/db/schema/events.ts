import { pgTable, uuid, text, timestamp, uniqueIndex, index, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { appUsers } from './identity';
import { persons } from './people';
import { eventStatusEnum, deliveryModeEnum, attendanceSourceEnum } from './enums';

export interface EventFormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number';
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

export interface EventFormConfig {
  headerTitle?: string;
  description?: string;
  collectEmail?: boolean;
  collectCity?: boolean;
  collectNotes?: boolean;
  requireGender?: boolean;
  collectVehicle?: boolean;
  allowMultiParticipant?: boolean;
  maxMultiParticipants?: number;
  customFields?: EventFormField[];
  whatsappMessageTemplate?: string;
  termsAndConditions?: string;
}

/**
 * 11. Events (Kajian Master Table)
 */
export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    speaker: text('speaker').notNull(),
    description: text('description'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }),
    deliveryMode: deliveryModeEnum('delivery_mode').default('offline').notNull(),
    locationName: text('location_name'),
    meetingUrl: text('meeting_url'),
    status: eventStatusEnum('status').default('scheduled').notNull(),
    
    // Segmentation & Audience Targeting
    targetAudience: text('target_audience').default('umum').notNull(), // 'umum' | 'ikhwan_only' | 'akhwat_only' | 'anak' | 'itikaf_ramadan'
    
    // Quota Management
    quota: integer('quota'),
    quotaIkhwan: integer('quota_ikhwan'),
    quotaAkhwat: integer('quota_akhwat'),
    isRegistrationOpen: boolean('is_registration_open').default(true).notNull(),
    
    // Parking & Logistics
    carParkingQuota: integer('car_parking_quota'),
    motorcycleParkingQuota: integer('motorcycle_parking_quota'),
    
    // Venue Rules & Restrictions
    venueRules: jsonb('venue_rules').$type<string[]>(), // e.g. ['no_toddlers', 'modest_dress', 'bring_prayer_mat', 'bring_kitab', 'silent_phone', 'stay_overnight']
    customVenueRules: text('custom_venue_rules'),
    
    // Paid Event & Banking Configuration
    isPaid: boolean('is_paid').default(false).notNull(),
    priceRupiah: integer('price_rupiah').default(0),
    bankName: text('bank_name'),
    bankAccountNumber: text('bank_account_number'),
    bankAccountName: text('bank_account_name'),
    paymentInstructions: text('payment_instructions'),

    // Dynamic Form Builder
    formConfig: jsonb('form_config').$type<EventFormConfig>(),
    
    createdBy: uuid('created_by')
      .references(() => appUsers.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    startAtIdx: index('idx_events_start_at').on(t.startAt),
    statusIdx: index('idx_events_status').on(t.status),
    targetAudienceIdx: index('idx_events_target_audience').on(t.targetAudience),
  })
);

/**
 * 12. Event Attendance Table
 * Enforces uniqueness per event & person to prevent double check-ins.
 */
export const eventAttendance = pgTable(
  'event_attendance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    checkInAt: timestamp('check_in_at', { withTimezone: true }).defaultNow().notNull(),
    source: attendanceSourceEnum('source').default('manual_input').notNull(),
    status: text('status').default('attended').notNull(),
    ticketCode: text('ticket_code'),
    
    // Multi-Participant / Family Group Registration
    registrationGroupId: text('registration_group_id'),
    familyRelationship: text('family_relationship'),
    age: integer('age'),

    // Payment & Verification Tracking
    paymentStatus: text('payment_status').default('free').notNull(), // 'free' | 'pending_payment' | 'waiting_verification' | 'verified' | 'rejected'
    paymentProofUrl: text('payment_proof_url'),
    paymentAmountRupiah: integer('payment_amount_rupiah'),
    paymentVerifiedBy: uuid('payment_verified_by').references(() => appUsers.id),
    paymentVerifiedAt: timestamp('payment_verified_at', { withTimezone: true }),
    paymentRejectionReason: text('payment_rejection_reason'),

    // Vehicle & Logistics
    vehicleType: text('vehicle_type').default('none').notNull(), // 'none' | 'motorcycle' | 'car'
    vehiclePlateNumber: text('vehicle_plate_number'),
    agreedToRules: boolean('agreed_to_rules').default(true).notNull(),
    
    registrationData: jsonb('registration_data').$type<Record<string, any>>(),
  },
  (t) => ({
    uniqueAttendance: uniqueIndex('idx_event_person_unique').on(t.eventId, t.personId),
    checkInIdx: index('idx_attendance_check_in').on(t.checkInAt),
    groupRegistrationIdx: index('idx_attendance_reg_group').on(t.registrationGroupId),
  })
);

// Relations
export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(appUsers, {
    fields: [events.createdBy],
    references: [appUsers.id],
  }),
  attendances: many(eventAttendance),
}));

export const eventAttendanceRelations = relations(eventAttendance, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendance.eventId],
    references: [events.id],
  }),
  person: one(persons, {
    fields: [eventAttendance.personId],
    references: [persons.id],
  }),
}));
