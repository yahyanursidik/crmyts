import { getServerEnv } from '../../config/env';
import { sendEventRegistrationTicketEmail, sendEventReminderEmail } from '../../email/service';

const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

type EventEmailConfig = {
  emailNotifications?: {
    registrationTicketEnabled?: boolean;
    reminderEnabled?: boolean;
    reminderHoursBefore?: number;
  };
} | null | undefined;

export type EventEmailEvent = {
  id: string;
  title: string;
  speaker: string;
  startAt: Date | string;
  locationName?: string | null;
  deliveryMode?: string | null;
  meetingUrl?: string | null;
  isPaid?: boolean | null;
  priceRupiah?: number | null;
  formConfig?: EventEmailConfig;
};

export type EventEmailAttendance = {
  id: string;
  ticketCode?: string | null;
  registrationGroupId?: string | null;
  familyRelationship?: string | null;
  registrationData?: Record<string, any> | null;
  person?: {
    fullName?: string | null;
    email?: string | null;
    gender?: 'ikhwan' | 'akhwat' | null;
  } | null;
};

/** The event timestamp is stored as an instant; all participant email uses WIB. */
export function formatEventDateTimeWib(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return `${new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: JAKARTA_TIME_ZONE,
  }).format(date)} WIB`;
}

export function getEventEmailSettings(config: EventEmailConfig) {
  const settings = config?.emailNotifications;
  const suppliedHours = Number(settings?.reminderHoursBefore);
  return {
    registrationTicketEnabled: settings?.registrationTicketEnabled !== false,
    reminderEnabled: settings?.reminderEnabled === true,
    reminderHoursBefore: Number.isFinite(suppliedHours) && suppliedHours >= 1 && suppliedHours <= 168
      ? Math.trunc(suppliedHours)
      : 24,
  };
}

function registrationLabel(attendance: EventEmailAttendance): string {
  const data = attendance.registrationData || {};
  if (data.isStaffRegistration === true || data.registrationChannel === 'staff') {
    return data.isStaffFamilyRegistration === true ? 'Keluarga Staff Yayasan' : 'Staff Yayasan';
  }
  if (data.isSpecialInvite === true || data.inviteSource) return 'Undangan Khusus';
  return 'Reguler';
}

function eventLocation(event: EventEmailEvent): string {
  if (event.deliveryMode === 'online') return 'Online';
  if (event.deliveryMode === 'hybrid') return event.locationName || 'Hybrid (daring dan luring)';
  return event.locationName || 'Masjid Tarbiyah Sunnah';
}

function eventUrl(eventId: string, ticketCode?: string | null): string {
  const base = `${getServerEnv().APP_URL.replace(/\/$/, '')}/peserta/${eventId}`;
  return ticketCode ? `${base}?ticket=${encodeURIComponent(ticketCode)}` : base;
}

function groupTickets(attendances: EventEmailAttendance[]) {
  return attendances.map((item) => ({
    name: item.person?.fullName || 'Peserta',
    relationship: item.familyRelationship || 'Peserta',
    ticketCode: item.ticketCode || '-',
  }));
}

export async function sendEventTicketEmail(input: {
  event: EventEmailEvent;
  attendance: EventEmailAttendance;
  groupAttendances?: EventEmailAttendance[];
}) {
  const { event, attendance } = input;
  const recipientEmail = attendance.person?.email?.trim();
  if (!recipientEmail) return { success: false, error: 'Peserta belum memiliki alamat email.' };

  const tickets = groupTickets(input.groupAttendances?.length ? input.groupAttendances : [attendance]);
  return sendEventRegistrationTicketEmail({
    recipientEmail,
    recipientName: attendance.person?.fullName || 'Jamaah YTS',
    eventTitle: event.title,
    speaker: event.speaker || 'Pemateri',
    startAtFormatted: formatEventDateTimeWib(event.startAt),
    locationName: eventLocation(event),
    ticketCode: attendance.ticketCode || '-',
    gender: attendance.person?.gender || null,
    registrationLabel: registrationLabel(attendance),
    familyCount: tickets.length > 1 ? tickets.length - 1 : undefined,
    groupTickets: tickets.length > 1 ? tickets : undefined,
    isPaid: event.isPaid === true,
    priceRupiah: event.priceRupiah || undefined,
    eventUrl: eventUrl(event.id, attendance.ticketCode),
  });
}

export async function sendEventReminder(input: {
  event: EventEmailEvent;
  attendance: EventEmailAttendance;
}) {
  const { event, attendance } = input;
  const recipientEmail = attendance.person?.email?.trim();
  if (!recipientEmail) return { success: false, error: 'Peserta belum memiliki alamat email.' };

  return sendEventReminderEmail({
    recipientEmail,
    recipientName: attendance.person?.fullName || 'Jamaah YTS',
    eventTitle: event.title,
    speaker: event.speaker || 'Pemateri',
    startAtFormatted: formatEventDateTimeWib(event.startAt),
    locationName: eventLocation(event),
    ticketCode: attendance.ticketCode || '-',
    eventUrl: eventUrl(event.id, attendance.ticketCode),
    meetingUrl: event.meetingUrl,
  });
}
