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
  bazaar: one(bazaarEvents, {
    fields: [events.id],
    references: [bazaarEvents.eventId],
  }),
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

/**
 * 13. Bazaar Events (Pengaturan Siklus Bazar per Daurah / Kajian)
 */
export const bazaarEvents = pgTable(
  'bazaar_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    isOpen: boolean('is_open').default(true).notNull(),
    rulesAndTerms: text('rules_and_terms'),
    defaultFeeRupiah: integer('default_fee_rupiah').default(0).notNull(),
    
    // Bank Payment Info
    bankName: text('bank_name'),
    bankAccountNumber: text('bank_account_number'),
    bankAccountName: text('bank_account_name'),
    paymentInstructions: text('payment_instructions'),
    
    // Deadlines & Survey settings
    registrationDeadline: timestamp('registration_deadline', { withTimezone: true }),
    paymentDeadline: timestamp('payment_deadline', { withTimezone: true }),
    surveyDeadline: timestamp('survey_deadline', { withTimezone: true }),
    surveyEnabled: boolean('survey_enabled').default(true).notNull(),

    // Zones configuration e.g. [{ id: 'zone_a', name: 'Selasar Timur', color: '#10b981' }]
    layoutZones: jsonb('layout_zones').$type<Array<{ id: string; name: string; description?: string; color?: string }>>(),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    eventIdIdx: uniqueIndex('idx_bazaar_events_event_id').on(t.eventId),
  })
);

/**
 * 14. Master Tenants (Tenant CRM Profil Lintas Event)
 */
export const bazaarTenants = pgTable(
  'bazaar_tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    personId: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    
    brandName: text('brand_name').notNull(),
    businessCategory: text('business_category').default('kuliner').notNull(),
    picName: text('pic_name').notNull(),
    picPhone: text('pic_phone').notNull(),
    picEmail: text('pic_email'),
    picKtpNumber: text('pic_ktp_number'),
    instagram: text('instagram'),
    address: text('address'),
    productDescription: text('product_description'),
    catalogUrls: jsonb('catalog_urls').$type<string[]>(),
    
    // Internal CRM Tags & Flags
    internalTags: jsonb('internal_tags').$type<string[]>().default([]), // e.g. ['Repeat Tenant', 'Partner', 'High Traffic']
    internalFlag: text('internal_flag').default('normal').notNull(), // 'normal' | 'review_next_event' | 'do_not_auto_accept'
    internalNotes: text('internal_notes'),
    isLegacyData: boolean('is_legacy_data').default(false).notNull(),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phoneIdx: index('idx_bazaar_tenants_phone').on(t.picPhone),
    brandIdx: index('idx_bazaar_tenants_brand').on(t.brandName),
    categoryIdx: index('idx_bazaar_tenants_category').on(t.businessCategory),
  })
);

/**
 * 15. Bazaar Booths (Slot Stand Inventori per Event)
 */
export const bazaarBooths = pgTable(
  'bazaar_booths',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bazaarId: uuid('bazaar_id')
      .references(() => bazaarEvents.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull(), // e.g. 'A-01', 'B-02'
    name: text('name').notNull(), // e.g. 'Booth Selasar A-01'
    zone: text('zone').default('Zona Utama').notNull(),
    size: text('size').default('2x2 meter'),
    facilities: jsonb('facilities').$type<string[]>(),
    priceRupiah: integer('price_rupiah').default(0).notNull(),
    allowedCategory: text('allowed_category').default('all').notNull(),
    status: text('status').default('available').notNull(), // 'available' | 'assigned' | 'reserved' | 'blocked'
    
    // Reserved for partner / donatur
    reservedReason: text('reserved_reason'),
    reservedForPartnerName: text('reserved_for_partner_name'),
    reservedBy: uuid('reserved_by').references(() => appUsers.id),
    
    positionX: integer('position_x').default(0),
    positionY: integer('position_y').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    bazaarCodeUnique: uniqueIndex('idx_bazaar_booths_bazaar_code').on(t.bazaarId, t.code),
    bazaarIdIdx: index('idx_bazaar_booths_bazaar_id').on(t.bazaarId),
  })
);

/**
 * 16. Bazaar Applications (Pendaftaran & Siklus 12 Status per Event)
 */
export const bazaarApplications = pgTable(
  'bazaar_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bazaarId: uuid('bazaar_id')
      .references(() => bazaarEvents.id, { onDelete: 'cascade' })
      .notNull(),
    tenantId: uuid('tenant_id')
      .references(() => bazaarTenants.id, { onDelete: 'cascade' })
      .notNull(),
    assignedBoothId: uuid('assigned_booth_id').references(() => bazaarBooths.id, { onDelete: 'set null' }),
    
    // 12-Stage Lifecycle Status
    status: text('status').default('submitted').notNull(), 
    // 'draft' | 'submitted' | 'under_review' | 'accepted' | 'waitlist' | 'rejected' | 'payment_pending' | 'payment_verification' | 'payment_verified' | 'booth_assigned' | 'checked_in' | 'completed' | 'cancelled'
    
    // Technical & Booth Preferences
    electricityNeeded: boolean('electricity_needed').default(false).notNull(),
    electricityWatts: integer('electricity_watts').default(0),
    specialRequests: text('special_requests'),
    boothPreferences: text('booth_preferences'),
    
    // Financial & Payment
    infaqAmountRupiah: integer('infaq_amount_rupiah').default(0).notNull(),
    paymentProofUrl: text('payment_proof_url'),
    paymentVerifiedAt: timestamp('payment_verified_at', { withTimezone: true }),
    paymentVerifiedBy: uuid('payment_verified_by').references(() => appUsers.id),
    paymentNotes: text('payment_notes'),
    
    // Layout Placement Rationale
    placementReason: text('placement_reason'), // 'category_isolation' | 'traffic_management' | 'power_access' | 'equity_rotation' | 'partner_reserved' | 'custom'
    placementNotes: text('placement_notes'),
    assignedBy: uuid('assigned_by').references(() => appUsers.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    isPublished: boolean('is_published').default(false).notNull(),
    
    // Review & Check-in
    rejectionReason: text('rejection_reason'),
    adminNotes: text('admin_notes'),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    checkedInBy: uuid('checked_in_by').references(() => appUsers.id),
    
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    bazaarTenantUnique: uniqueIndex('idx_bazaar_apps_bazaar_tenant').on(t.bazaarId, t.tenantId),
    bazaarIdIdx: index('idx_bazaar_apps_bazaar_id').on(t.bazaarId),
    statusIdx: index('idx_bazaar_apps_status').on(t.status),
  })
);

/**
 * 17. Bazaar Surveys (Survei Kepuasan & Rentang Omzet Pasca-Event)
 */
export const bazaarSurveys = pgTable(
  'bazaar_surveys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .references(() => bazaarApplications.id, { onDelete: 'cascade' })
      .notNull(),
    tenantId: uuid('tenant_id')
      .references(() => bazaarTenants.id, { onDelete: 'cascade' })
      .notNull(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
      
    // Rating 1-5
    satisfactionOverall: integer('satisfaction_overall').notNull(),
    satisfactionLocation: integer('satisfaction_location').notNull(),
    satisfactionFacilities: integer('satisfaction_facilities').notNull(),
    satisfactionCommunication: integer('satisfaction_communication').notNull(),
    satisfactionTraffic: integer('satisfaction_traffic').notNull(),
    
    // Omzet Range (<1m, 1-2m, 2-5m, 5-10m, >10m)
    omzetRange: text('omzet_range').notNull(), 
    feedback: text('feedback'),
    willingToJoinNext: boolean('willing_to_join_next').default(true).notNull(),
    
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    appIdUnique: uniqueIndex('idx_bazaar_surveys_app_id').on(t.applicationId),
    tenantIdIdx: index('idx_bazaar_surveys_tenant_id').on(t.tenantId),
  })
);

/**
 * 18. Bazaar Incidents (Log Catatan Hari-H: Pelanggaran & Apresiasi Positif)
 */
export const bazaarIncidents = pgTable(
  'bazaar_incidents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .references(() => bazaarApplications.id, { onDelete: 'cascade' })
      .notNull(),
    tenantId: uuid('tenant_id')
      .references(() => bazaarTenants.id, { onDelete: 'cascade' })
      .notNull(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
      
    type: text('type').default('negative').notNull(), // 'negative' | 'positive'
    category: text('category').notNull(), // 'tardiness' | 'booth_boundary' | 'cleanliness' | 'electricity_overload' | 'blocking_aisle' | 'abandoning_booth' | 'visitor_complaint' | 'exemplary_cooperation' | 'neat_booth' | 'volunteer_help' | 'prayer_discipline' | 'other'
    severity: text('severity').default('minor').notNull(), // 'minor' | 'moderate' | 'major'
    description: text('description').notNull(),
    photoUrl: text('photo_url'),
    
    recordedBy: uuid('recorded_by').references(() => appUsers.id).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index('idx_bazaar_incidents_tenant').on(t.tenantId),
    eventIdx: index('idx_bazaar_incidents_event').on(t.eventId),
  })
);

/**
 * 19. Bazaar Staff Evaluations (Evaluasi Internal Panitia)
 */
export const bazaarEvaluations = pgTable(
  'bazaar_evaluations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .references(() => bazaarApplications.id, { onDelete: 'cascade' })
      .notNull(),
    tenantId: uuid('tenant_id')
      .references(() => bazaarTenants.id, { onDelete: 'cascade' })
      .notNull(),
    eventId: uuid('event_id')
      .references(() => events.id, { onDelete: 'cascade' })
      .notNull(),
      
    shariaComplianceScore: integer('sharia_compliance_score').default(5).notNull(),
    cooperationScore: integer('cooperation_score').default(5).notNull(),
    cleanlinessScore: integer('cleanliness_score').default(5).notNull(),
    trafficDisruptionRisk: integer('traffic_disruption_risk').default(1).notNull(),
    recommendNextEvent: boolean('recommend_next_event').default(true).notNull(),
    suggestedFlag: text('suggested_flag').default('normal').notNull(), // 'normal' | 'review_next_event' | 'do_not_auto_accept'
    internalNotes: text('internal_notes'),
    
    evaluatedBy: uuid('evaluated_by').references(() => appUsers.id).notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    appIdUnique: uniqueIndex('idx_bazaar_evals_app_id').on(t.applicationId),
    tenantIdx: index('idx_bazaar_evals_tenant').on(t.tenantId),
  })
);

// Bazaar Relations
export const bazaarEventsRelations = relations(bazaarEvents, ({ one, many }) => ({
  event: one(events, {
    fields: [bazaarEvents.eventId],
    references: [events.id],
  }),
  booths: many(bazaarBooths),
  applications: many(bazaarApplications),
}));

export const bazaarTenantsRelations = relations(bazaarTenants, ({ one, many }) => ({
  person: one(persons, {
    fields: [bazaarTenants.personId],
    references: [persons.id],
  }),
  applications: many(bazaarApplications),
  surveys: many(bazaarSurveys),
  incidents: many(bazaarIncidents),
  evaluations: many(bazaarEvaluations),
}));

export const bazaarBoothsRelations = relations(bazaarBooths, ({ one }) => ({
  bazaar: one(bazaarEvents, {
    fields: [bazaarBooths.bazaarId],
    references: [bazaarEvents.id],
  }),
  reservedByUser: one(appUsers, {
    fields: [bazaarBooths.reservedBy],
    references: [appUsers.id],
  }),
  assignedApplication: one(bazaarApplications, {
    fields: [bazaarBooths.id],
    references: [bazaarApplications.assignedBoothId],
  }),
}));

export const bazaarApplicationsRelations = relations(bazaarApplications, ({ one }) => ({
  bazaar: one(bazaarEvents, {
    fields: [bazaarApplications.bazaarId],
    references: [bazaarEvents.id],
  }),
  tenant: one(bazaarTenants, {
    fields: [bazaarApplications.tenantId],
    references: [bazaarTenants.id],
  }),
  assignedBooth: one(bazaarBooths, {
    fields: [bazaarApplications.assignedBoothId],
    references: [bazaarBooths.id],
  }),
  verifiedBy: one(appUsers, {
    fields: [bazaarApplications.paymentVerifiedBy],
    references: [appUsers.id],
  }),
  assignedByUser: one(appUsers, {
    fields: [bazaarApplications.assignedBy],
    references: [appUsers.id],
  }),
  survey: one(bazaarSurveys, {
    fields: [bazaarApplications.id],
    references: [bazaarSurveys.applicationId],
  }),
  evaluation: one(bazaarEvaluations, {
    fields: [bazaarApplications.id],
    references: [bazaarEvaluations.applicationId],
  }),
}));

export const bazaarSurveysRelations = relations(bazaarSurveys, ({ one }) => ({
  application: one(bazaarApplications, {
    fields: [bazaarSurveys.applicationId],
    references: [bazaarApplications.id],
  }),
  tenant: one(bazaarTenants, {
    fields: [bazaarSurveys.tenantId],
    references: [bazaarTenants.id],
  }),
  event: one(events, {
    fields: [bazaarSurveys.eventId],
    references: [events.id],
  }),
}));

export const bazaarIncidentsRelations = relations(bazaarIncidents, ({ one }) => ({
  application: one(bazaarApplications, {
    fields: [bazaarIncidents.applicationId],
    references: [bazaarApplications.id],
  }),
  tenant: one(bazaarTenants, {
    fields: [bazaarIncidents.tenantId],
    references: [bazaarTenants.id],
  }),
  event: one(events, {
    fields: [bazaarIncidents.eventId],
    references: [events.id],
  }),
  recorder: one(appUsers, {
    fields: [bazaarIncidents.recordedBy],
    references: [appUsers.id],
  }),
}));

export const bazaarEvaluationsRelations = relations(bazaarEvaluations, ({ one }) => ({
  application: one(bazaarApplications, {
    fields: [bazaarEvaluations.applicationId],
    references: [bazaarApplications.id],
  }),
  tenant: one(bazaarTenants, {
    fields: [bazaarEvaluations.tenantId],
    references: [bazaarTenants.id],
  }),
  event: one(events, {
    fields: [bazaarEvaluations.eventId],
    references: [events.id],
  }),
  evaluator: one(appUsers, {
    fields: [bazaarEvaluations.evaluatedBy],
    references: [appUsers.id],
  }),
}));


