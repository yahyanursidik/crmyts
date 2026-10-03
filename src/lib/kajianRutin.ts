import { toDataURL } from 'qrcode';

/**
 * Tipe & helper bersama untuk fitur Kajian Rutin
 * (halaman admin /kajian-rutin dan portal absensi /peserta/kajian).
 */

export const KAJIAN_RUTIN_PORTAL_TOKEN_KEY = 'kajian_rutin_portal_token';

export interface KajianRutinSeries {
  id: string;
  title: string;
  description: string | null;
  speaker: string | null;
  recurrence: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek: number | null;
  startTime: string;
  endTime: string | null;
  locationName: string | null;
  locationAddress: string | null;
  targetAudience: 'umum' | 'ikhwan_only' | 'akhwat_only' | 'anak';
  quota: number | null;
  checkInOpenMinutes: number;
  checkInCloseMinutes: number;
  isActive: boolean;
  createdAt: string;
  totalSessions?: number;
  nextSessionDate?: string | null;
  totalAttendance?: number;
  lastAttendanceAt?: string | null;
}

export interface KajianRutinSession {
  id: string;
  seriesId: string;
  sessionDate: string;
  startAt: string;
  endAt: string | null;
  topic: string | null;
  notes: string | null;
  status: 'scheduled' | 'cancelled';
  qrToken?: string;
  qrRotatedAt?: string | null;
  attendanceCount?: number;
}

export interface KajianRutinAttendanceRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  note: string | null;
  checkInAt: string;
}

export interface KajianRutinScanContext {
  session: {
    id: string;
    sessionDate: string;
    startAt: string;
    endAt: string | null;
    topic: string | null;
    status: string;
  };
  series: {
    id: string;
    title: string;
    speaker: string | null;
    locationName: string | null;
  };
  checkInWindow: { openAt: string; closeAt: string; isOpen: boolean };
}

export interface PortalSessionItem {
  sessionId: string;
  sessionDate: string;
  startAt: string;
  endAt: string | null;
  topic: string | null;
  seriesId: string;
  seriesTitle: string;
  speaker: string | null;
  locationName: string | null;
  startTime: string;
  endTime: string | null;
  windowOpenAt: string;
  windowCloseAt: string;
  isOpen: boolean;
  alreadyAbsen: string | null;
}

export const WEEKDAY_NAMES = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

/** Kajian daurah (event satu kali) di portal peserta. */
export interface DaurahEventItem {
  id: string;
  title: string;
  speaker: string | null;
  startAt: string;
  endAt: string | null;
  locationName: string | null;
  deliveryMode: string;
  targetAudience: string;
  isRegistrationOpen: boolean;
  status: string;
  myTicket: {
    id: string;
    ticketCode: string | null;
    status: string;
    checkInAt: string | null;
  } | null;
  canSelfCheckin: boolean;
  windowOpenAt: string;
  windowCloseAt: string;
}

export interface DaurahHistoryItem {
  id: string;
  eventId: string;
  title: string;
  eventStartAt: string;
  ticketCode: string | null;
  checkInAt: string | null;
}

export const RECURRENCE_LABELS: Record<KajianRutinSeries['recurrence'], string> = {
  weekly: 'Setiap pekan',
  biweekly: 'Setiap 2 pekan',
  monthly: 'Setiap bulan',
};

export const TARGET_AUDIENCE_LABELS: Record<KajianRutinSeries['targetAudience'], string> = {
  umum: 'Umum',
  ikhwan_only: 'Khusus Ikhwan',
  akhwat_only: 'Khusus Akhwat',
  anak: 'Anak-anak',
};

export const SOURCE_LABELS: Record<string, string> = {
  qr_self_scan: 'Scan QR',
  portal_self_scan: 'Portal Peserta',
  manual_input: 'Input Panitia',
};

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatWibDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatWibShortDate(iso: string): string {
  return shortDateFmt.format(new Date(iso));
}

export function formatWibTime(iso: string): string {
  return `${timeFmt.format(new Date(iso))} WIB`;
}

export function formatWibDateTime(iso: string): string {
  return `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))} WIB`;
}

/** Tanggal kalender WIB (YYYY-MM-DD) dari string ISO. */
export function wibDatePart(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Tautan yang dienkode ke dalam QR absensi kajian rutin. */
export function buildKajianRutinQrUrl(sessionId: string, token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/peserta/kajian?sesi=${encodeURIComponent(sessionId)}&t=${encodeURIComponent(token)}`;
}

export async function renderQrDataUrl(payload: string): Promise<string> {
  return toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#1c321d', light: '#ffffff' },
  });
}

export function describeJadwal(series: Pick<KajianRutinSeries, 'recurrence' | 'dayOfWeek' | 'startTime' | 'endTime'>): string {
  const parts: string[] = [RECURRENCE_LABELS[series.recurrence] || 'Terjadwal'];
  if (series.dayOfWeek !== null && series.dayOfWeek !== undefined) {
    parts.push(WEEKDAY_NAMES[series.dayOfWeek] || '');
  }
  parts.push(`${series.startTime} WIB`);
  if (series.endTime) parts.push(`– ${series.endTime} WIB`);
  return parts.filter(Boolean).join(' • ');
}
