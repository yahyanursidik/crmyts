import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { extractTicketCode } from '../../../src/lib/participantTicket';
import {
  auditLogs,
  eventAttendance,
  events,
  personRoles,
  persons,
} from '../../db/schema';
import { getDb } from '../../db/client';
import { isValidE164, normalizeIndonesianPhone } from '../../lib/phone';
import { createAvailableTicketCode } from './availableTicket';
import {
  isRegularRegistration,
  isSpecialInviteRegistration,
} from './registrationChannels';
import { findEventRegistrationByPhone } from './registrationPhoneGuard';
import { withEventRegistrationLock } from './registrationLock';

export class RegistrationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const inputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Nama lengkap minimal 3 karakter.')
    .max(160),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(24)
    .refine(
      (value) => /^[+\d\s().-]+$/.test(value),
      'Nomor WhatsApp tidak valid.',
    ),
  gender: z.enum(['ikhwan', 'akhwat']).default('ikhwan'),
  email: z
    .string()
    .trim()
    .email('Email tidak valid.')
    .or(z.literal(''))
    .optional(),
  cityRegency: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  age: z.preprocess(
    (value) => (value === '' || value == null ? undefined : Number(value)),
    z.number().int().min(1).max(120).optional(),
  ),
  vehicleType: z.enum(['none', 'car', 'motorcycle']).default('none'),
  vehiclePlateNumber: z.string().trim().max(24).optional().nullable(),
  isSpecialInvite: z.boolean().default(false),
  inviteNotes: z.string().trim().max(500).optional(),
  status: z.enum(['registered', 'attended']).default('registered'),
  ticketCode: z.string().trim().max(240).optional(),
  registrationData: z.record(z.unknown()).optional().nullable(),
});

export async function registerStaffParticipant(
  db: ReturnType<typeof getDb>,
  eventId: string,
  raw: unknown,
  actor: { id: string; email?: string },
  requestId: string,
  options: { source: 'manual_input' | 'csv_import'; fillMissing?: boolean },
) {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success)
    throw new RegistrationError(
      parsed.error.issues[0]?.message || 'Data peserta tidak valid.',
    );
  const item = parsed.data;
  const phone = normalizeIndonesianPhone(item.phone);
  if (!isValidE164(phone))
    throw new RegistrationError('Nomor WhatsApp tidak valid.');
  return withEventRegistrationLock(db, eventId, async (tx) => {
    const event = await tx.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (!event) throw new RegistrationError('Kajian tidak ditemukan.', 404);
    if (event.status === 'cancelled')
      throw new RegistrationError(
        'Event telah dibatalkan. Pendaftaran ditutup.',
      );
    if (event.isPaid && item.status === 'attended')
      throw new RegistrationError(
        'Impor sebagai Terdaftar, lalu verifikasi pembayaran sebelum mencatat hadir.',
      );
    if (event.targetAudience === 'ikhwan_only' && item.gender !== 'ikhwan')
      throw new RegistrationError('Event ini khusus Ikhwan.');
    if (event.targetAudience === 'akhwat_only' && item.gender !== 'akhwat')
      throw new RegistrationError('Event ini khusus Akhwat.');
    if (event.minAge && (!item.age || item.age < event.minAge))
      throw new RegistrationError(
        `Usia minimal ${event.minAge} tahun. Isi usia peserta.`,
      );
    const duplicate = await findEventRegistrationByPhone(tx, eventId, phone);
    if (duplicate)
      throw new RegistrationError(
        'Nomor WhatsApp ini sudah terdaftar pada kajian ini.',
        409,
      );

    const roster = await tx.query.eventAttendance.findMany({
      where: eq(eventAttendance.eventId, eventId),
      columns: {
        id: true,
        personId: true,
        registrationData: true,
        referredByAttendanceId: true,
        vehicleType: true,
      },
      with: { person: { columns: { gender: true } } },
    });
    const ticketCode = item.ticketCode
      ? extractTicketCode(item.ticketCode)
      : await createAvailableTicketCode(tx, eventId);
    if (!/^[A-Z0-9][A-Z0-9_-]{2,79}$/.test(ticketCode))
      throw new RegistrationError('Kode tiket tidak valid.');
    const existingTicket =
      item.ticketCode &&
      (await tx.query.eventAttendance.findFirst({
        where: and(
          eq(eventAttendance.eventId, eventId),
          eq(eventAttendance.ticketCode, ticketCode),
        ),
      }));
    if (existingTicket)
      throw new RegistrationError(
        'Kode tiket sudah digunakan. Kosongkan kolom tiket untuk membuat kode baru.',
        409,
      );
    const channel = roster.filter(
      item.isSpecialInvite
        ? isSpecialInviteRegistration
        : isRegularRegistration,
    );
    const quota = item.isSpecialInvite ? event.quotaInvite : event.quota;
    const genderQuota = item.isSpecialInvite
      ? item.gender === 'ikhwan'
        ? event.quotaInviteIkhwan
        : event.quotaInviteAkhwat
      : item.gender === 'ikhwan'
        ? event.quotaIkhwan
        : event.quotaAkhwat;
    if (quota && channel.length >= quota)
      throw new RegistrationError('Kuota jalur pendaftaran telah penuh.');
    if (
      genderQuota &&
      channel.filter((row) => row.person?.gender === item.gender).length >=
        genderQuota
    )
      throw new RegistrationError(
        `Kuota ${item.gender === 'ikhwan' ? 'Ikhwan' : 'Akhwat'} telah penuh.`,
      );
    const parkingQuota =
      item.vehicleType === 'car'
        ? event.carParkingQuota
        : item.vehicleType === 'motorcycle'
          ? event.motorcycleParkingQuota
          : null;
    if (
      parkingQuota &&
      roster.filter((row) => row.vehicleType === item.vehicleType).length >=
        parkingQuota
    )
      throw new RegistrationError('Kuota parkir kendaraan telah penuh.');

    // Matching an archived or ambiguous contact requires a conscious People decision.
    const matches = await tx.query.persons.findMany({
      where: eq(persons.phoneE164, phone),
    });
    if (matches.length > 1)
      throw new RegistrationError(
        'Kontak memiliki beberapa profil. Tinjau duplikat melalui menu Jamaah.',
        409,
      );
    let person = matches[0];
    if (person?.isActive === false)
      throw new RegistrationError(
        'Profil jamaah diarsipkan. Pulihkan melalui menu Jamaah terlebih dahulu.',
        409,
      );
    if (person?.gender && person.gender !== item.gender)
      throw new RegistrationError(
        'Gender berbeda dengan profil Jamaah. Periksa profil atau pilihan gender terlebih dahulu.',
        409,
      );
    if (person && !person.gender)
      [person] = await tx
        .update(persons)
        .set({ gender: item.gender, updatedAt: new Date() })
        .where(eq(persons.id, person.id))
        .returning();
    const email = item.email?.toLowerCase() || null;
    if (email && (!person || person.email !== email)) {
      const emailOwner = await tx.query.persons.findFirst({
        where: eq(persons.email, email),
      });
      if (emailOwner && emailOwner.id !== person?.id)
        throw new RegistrationError(
          'Email sudah digunakan profil jamaah lain. Tinjau melalui menu Jamaah.',
          409,
        );
    }
    if (!person) {
      [person] = await tx
        .insert(persons)
        .values({
          fullName: item.fullName,
          phoneE164: phone,
          gender: item.gender,
          email,
          cityRegency: item.cityRegency || item.city || null,
          province: item.province || null,
          district: item.district || null,
          sourceCode:
            options.source === 'csv_import'
              ? 'csv_import'
              : 'manual_staff_event',
          ownerUserId: actor.id,
          engagementStatus: item.status === 'attended' ? 'aktif' : 'baru',
        })
        .returning();
    } else if (options.fillMissing) {
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries({
        email,
        cityRegency: item.cityRegency || item.city,
        province: item.province,
        district: item.district,
      })) {
        if (!person[key as keyof typeof person] && value) patch[key] = value;
      }
      if (Object.keys(patch).length)
        [person] = await tx
          .update(persons)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(persons.id, person.id))
          .returning();
    }
    if (!person)
      throw new RegistrationError('Gagal membuat profil jamaah.', 500);
    if (roster.some((row) => row.personId === person.id))
      throw new RegistrationError(
        'Jamaah sudah terdaftar pada kajian ini.',
        409,
      );
    await tx
      .insert(personRoles)
      .values({ personId: person.id, roleCode: 'jamaah' })
      .onConflictDoNothing();
    const customData: Record<string, unknown> = {};
    for (const field of (event.formConfig?.customFields || []) as Array<{
      id: string;
    }>) {
      const value = item.registrationData?.[field.id];
      if (
        value !== undefined &&
        ![
          'registrationChannel',
          'isSpecialInvite',
          'inviteSource',
          'registeredByAdmin',
          'emailNotifications',
          '__proto__',
          'constructor',
          'prototype',
        ].includes(field.id)
      )
        customData[field.id] = value;
    }
    const [attendance] = await tx
      .insert(eventAttendance)
      .values({
        eventId,
        personId: person.id,
        source: options.source,
        status: item.status,
        ticketCode,
        age: item.age || null,
        vehicleType: item.vehicleType,
        vehiclePlateNumber: item.vehiclePlateNumber || null,
        // Historical CSV attendance is recorded without inventing an arrival time.
        checkInAt: null,
        paymentStatus: event.isPaid ? 'pending_payment' : 'free',
        paymentAmountRupiah: event.isPaid ? event.priceRupiah : 0,
        registrationData: {
          ...customData,
          addedVia: options.source,
          registeredByAdmin: actor.email || actor.id,
          ...(item.isSpecialInvite
            ? {
                isSpecialInvite: true,
                inviteSource: 'admin_dashboard',
                inviteNotes: item.inviteNotes || null,
              }
            : {}),
        },
      })
      .returning();
    if (!attendance)
      throw new RegistrationError('Pendaftaran gagal disimpan.', 500);
    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: 'register_event_participant',
      entityType: 'event_attendance',
      entityId: attendance.id,
      afterJson: {
        eventId,
        personId: person.id,
        status: attendance.status,
        paymentStatus: attendance.paymentStatus,
        source: options.source,
      },
      reason: 'Pendaftaran peserta oleh pengelola',
      requestId,
    });
    return { attendance, person, event };
  });
}
