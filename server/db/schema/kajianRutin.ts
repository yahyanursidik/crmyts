import { pgTable, uuid, text, timestamp, boolean, integer, date, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { appUsers } from './identity';

/**
 * Kajian Rutin — seri kajian yang berulang (mis. pekanan). Terpisah dari tabel
 * events (kajian satu kali) agar absensi mandiri jamaah tetap sederhana.
 */
export const kajianRutinSeries = pgTable(
  'kajian_rutin_series',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    speaker: text('speaker'),
    recurrence: text('recurrence').default('weekly').notNull(), // 'weekly' | 'biweekly' | 'monthly'
    dayOfWeek: integer('day_of_week'), // 0=Ahad .. 6=Sabtu
    startDate: date('start_date'), // tanggal kajian pertama (kalender WIB)
    startTime: text('start_time').default('07:00').notNull(), // WIB, 'HH:mm'
    endTime: text('end_time'), // WIB, 'HH:mm'
    locationName: text('location_name'),
    locationAddress: text('location_address'),
    targetAudience: text('target_audience').default('umum').notNull(),
    quota: integer('quota'),
    posterUrl: text('poster_url'), // thumbnail/poster kajian (admin & portal peserta)
    checkInOpenMinutes: integer('check_in_open_minutes').default(240).notNull(),
    checkInCloseMinutes: integer('check_in_close_minutes').default(300).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdBy: uuid('created_by').references(() => appUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activeIdx: index('idx_kajian_rutin_series_active').on(t.isActive),
  })
);

/**
 * Master pemateri/ustadz agar tidak mengetik ulang di setiap kajian.
 */
export const kajianRutinSpeakers = pgTable(
  'kajian_rutin_speakers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => appUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameUnique: uniqueIndex('idx_kajian_rutin_speakers_name').on(t.name),
  })
);

/**
 * Sesi pertemuan tunggal dari sebuah seri. QR absensi memuat qrToken yang
 * hanya diterbitkan lewat halaman admin dan dapat dirotasi bila bocor.
 * startTime/endTime/locationName/speaker bersifat override per sesi
 * (null = ikut nilai seri) agar jadwal tiap pertemuan tetap fleksibel.
 */
export const kajianRutinSessions = pgTable(
  'kajian_rutin_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    seriesId: uuid('series_id')
      .references(() => kajianRutinSeries.id, { onDelete: 'cascade' })
      .notNull(),
    sessionDate: date('session_date').notNull(), // 'YYYY-MM-DD' kalender WIB
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }),
    startTime: text('start_time'), // override jam mulai WIB
    endTime: text('end_time'), // override jam selesai WIB
    locationName: text('location_name'), // override lokasi
    speaker: text('speaker'), // override pemateri
    topic: text('topic'),
    notes: text('notes'),
    status: text('status').default('scheduled').notNull(), // 'scheduled' | 'cancelled'
    qrToken: text('qr_token').notNull(),
    qrRotatedAt: timestamp('qr_rotated_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => appUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    seriesDateUnique: uniqueIndex('idx_kajian_rutin_sessions_series_date').on(t.seriesId, t.sessionDate),
    qrTokenUnique: uniqueIndex('idx_kajian_rutin_sessions_qr_token').on(t.qrToken),
    seriesIdx: index('idx_kajian_rutin_sessions_series').on(t.seriesId),
    startAtIdx: index('idx_kajian_rutin_sessions_start_at').on(t.startAt),
  })
);

/**
 * Profil akun Google jamaah (cache ringan hasil verifikasi ID token).
 */
export const kajianRutinAccounts = pgTable(
  'kajian_rutin_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    googleSub: text('google_sub').notNull(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    pictureUrl: text('picture_url'),
    phone: text('phone'),
    gender: text('gender'), // 'ikhwan' | 'akhwat'
    cityRegency: text('city_regency'),
    province: text('province'),
    educationLevel: text('education_level'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    googleSubUnique: uniqueIndex('idx_kajian_rutin_accounts_sub').on(t.googleSub),
    emailIdx: index('idx_kajian_rutin_accounts_email').on(t.email),
  })
);

/**
 * Absensi jamaah per sesi. Unik per (sesi, googleSub) mencegah absen ganda.
 */
export const kajianRutinAttendance = pgTable(
  'kajian_rutin_attendance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .references(() => kajianRutinSessions.id, { onDelete: 'cascade' })
      .notNull(),
    seriesId: uuid('series_id')
      .references(() => kajianRutinSeries.id, { onDelete: 'cascade' })
      .notNull(),
    accountId: uuid('account_id').references(() => kajianRutinAccounts.id, { onDelete: 'set null' }),
    googleSub: text('google_sub').notNull(), // 'manual:<uuid>' untuk input manual panitia
    email: text('email'),
    fullName: text('full_name').notNull(),
    pictureUrl: text('picture_url'),
    phone: text('phone'),
    source: text('source').default('qr_self_scan').notNull(), // 'qr_self_scan' | 'manual_input'
    status: text('status').default('present').notNull(), // 'present' | 'excused'
    note: text('note'),
    checkInAt: timestamp('check_in_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionSubUnique: uniqueIndex('idx_kajian_rutin_attendance_session_sub').on(t.sessionId, t.googleSub),
    sessionIdx: index('idx_kajian_rutin_attendance_session').on(t.sessionId),
    seriesIdx: index('idx_kajian_rutin_attendance_series').on(t.seriesId),
    checkInIdx: index('idx_kajian_rutin_attendance_check_in').on(t.checkInAt),
  })
);

/** Rate limit sederhana untuk endpoint publik portal (login & absen). */
export const kajianRutinRateLimits = pgTable('kajian_rutin_rate_limits', {
  key: text('key').primaryKey(),
  hits: integer('hits').default(1).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
