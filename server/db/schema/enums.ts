import { pgEnum } from 'drizzle-orm/pg-core';

// Gender Enum
export const genderEnum = pgEnum('gender_enum', [
  'ikhwan',
  'akhwat',
]);

// Engagement Status Enum
export const engagementStatusEnum = pgEnum('engagement_status_enum', [
  'baru',
  'aktif',
  'rutin',
  'sangat_aktif',
  'dorman',
  'kembali_aktif',
]);

// Preferred Communication Channel Enum
export const preferredChannelEnum = pgEnum('preferred_channel_enum', [
  'whatsapp',
  'phone',
  'telegram',
  'email',
  'in_person',
]);

// Event Status Enum
export const eventStatusEnum = pgEnum('event_status_enum', [
  'scheduled',
  'ongoing',
  'completed',
  'cancelled',
]);

// Event Delivery Mode Enum
export const deliveryModeEnum = pgEnum('delivery_mode_enum', [
  'offline',
  'online',
  'hybrid',
]);

// Attendance Check-in Source Enum
export const attendanceSourceEnum = pgEnum('attendance_source_enum', [
  'manual_input',
  'qr_scan',
  'csv_import',
  'form_registration',
]);

// Interaction Channel Enum
export const interactionChannelEnum = pgEnum('interaction_channel_enum', [
  'whatsapp',
  'phone_call',
  'in_person',
  'telegram',
  'email',
  'other',
]);

// Task Follow-Up Status Enum
export const taskStatusEnum = pgEnum('task_status_enum', [
  'pending',
  'in_progress',
  'waiting',
  'completed',
  'cancelled',
]);

// Task Priority Enum
export const taskPriorityEnum = pgEnum('task_priority_enum', [
  'low',
  'medium',
  'high',
  'urgent',
]);

// Donation Verification Status Enum
export const donationStatusEnum = pgEnum('donation_status_enum', [
  'unverified',
  'verified',
  'rejected',
  'need_review',
]);

// Payment Method Enum
export const paymentMethodEnum = pgEnum('payment_method_enum', [
  'bank_transfer',
  'qris',
  'cash',
  'other',
]);

// Waqf Pipeline Stage Enum
export const waqfStageEnum = pgEnum('waqf_stage_enum', [
  'interested',
  'consulted',
  'pledged',
  'document_preparation',
  'in_progress',
  'completed',
  'stewardship',
]);

// Waqf Type Enum
export const waqfTypeEnum = pgEnum('waqf_type_enum', [
  'tanah',
  'bangunan',
  'uang',
  'kendaraan',
  'logistik_dakwah',
  'sarana_air',
  'lainnya',
]);

// Donor Pipeline Lifecycle Stage Enum
export const donorPipelineStageEnum = pgEnum('donor_pipeline_stage_enum', [
  'new_lead',
  'contacted',
  'interested',
  'donated_once',
  'regular_donor',
  'loyal',
  'dormant',
]);
