import { getWhatsAppLink, normalizePhoneE164, isValidE164 } from '@/lib/phone';

export const ENGAGEMENT_LABELS: Record<string, string> = {
  baru: 'Baru',
  aktif: 'Aktif',
  rutin: 'Rutin',
  sangat_aktif: 'Sangat aktif',
  dorman: 'Perlu disapa',
  kembali_aktif: 'Kembali aktif',
};
export const ROLE_LABELS: Record<string, string> = {
  jamaah: 'Jamaah',
  donatur: 'Donatur',
  wakif: 'Wakif',
  relawan: 'Relawan',
  mustahiq: 'Mustahiq',
  tokoh: 'Asatidz / tokoh',
};
export const STATUS_LABELS: Record<string, string> = {
  attended: 'Hadir',
  registered: 'Terdaftar',
  present: 'Hadir',
  excused: 'Izin',
  cancelled: 'Dibatalkan',
  pending: 'Belum dimulai',
  in_progress: 'Dikerjakan',
  waiting: 'Menunggu',
  completed: 'Selesai',
  verified: 'Terverifikasi',
  unverified: 'Belum diverifikasi',
  need_review: 'Perlu diperiksa',
  rejected: 'Ditolak',
  restricted: 'Terbatas',
  confidential: 'Khusus',
  standard: 'Umum',
  high: 'Khusus',
};
export const WAQF_LABELS: Record<string, string> = {
  interested: 'Penjajakan',
  consulted: 'Konsultasi',
  pledged: 'Komitmen',
  document_preparation: 'Pemberkasan',
  in_progress: 'Proses legalitas',
  completed: 'Serah terima',
  stewardship: 'Pengelolaan aset',
};
export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  phone_call: 'Telepon',
  in_person: 'Tatap muka',
  telegram: 'Telegram',
  email: 'Email',
  other: 'Lainnya',
};
export const OPEN_TASK_STATUSES = ['pending', 'in_progress', 'waiting'];
export const formatNumber = (value: number) =>
  new Intl.NumberFormat('id-ID').format(value);
export const formatMoney = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
export function formatDate(value?: string | null, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'JM';
export function personWhatsApp(phone?: string | null, message?: string) {
  if (!phone || /[a-z]/i.test(phone)) return null;
  const normalized = normalizePhoneE164(phone);
  return isValidE164(normalized) ? getWhatsAppLink(normalized, message) : null;
}
export function personModuleLink(
  path: '/tasks' | '/donations' | '/waqf' | '/interactions',
  personId: string,
  create = false,
) {
  return `${path}?${new URLSearchParams({ personId, ...(create ? { action: 'create' } : {}) })}`;
}
export function peopleBackPath(value: string | null) {
  return value && /^\/people(?:\?|$)/.test(value) ? value : '/people';
}
