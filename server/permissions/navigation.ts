import { PERMISSIONS as P, type PermissionCode, type RoleCode } from './constants';

export const ROLE_LABELS: Record<RoleCode, string> = {
  leadership_viewer: 'Pimpinan Yayasan', crm_admin: 'Administrator CRM',
  data_steward: 'Pengelola Data', cs_officer: 'Layanan Jamaah', event_admin: 'Admin Event',
  fundraising_officer: 'Fundraising', waqf_officer: 'Pengelola Wakaf',
  finance_verifier: 'Verifikator Keuangan', broadcast_officer: 'Komunikasi & Broadcast', auditor: 'Auditor',
};

export interface AppDestination {
  path: string;
  label: string;
  group: 'Ringkasan' | 'Jamaah & kegiatan' | 'Donasi & wakaf' | 'Pengelolaan';
  icon: string;
  permissions: readonly PermissionCode[];
  description: string;
}

// Shared by routes, navigation, search and dashboard links. Permissions use OR.
export const APP_DESTINATIONS: readonly AppDestination[] = [
  { path: '/', label: 'Beranda', group: 'Ringkasan', icon: 'LayoutDashboard', permissions: [P.DASHBOARD_VIEW], description: 'Ringkasan pekerjaan sesuai peran' },
  { path: '/people', label: 'Jamaah', group: 'Jamaah & kegiatan', icon: 'IdCard', permissions: [P.PERSONS_LIST], description: 'Profil, kontak dan riwayat jamaah' },
  { path: '/events', label: 'Event & presensi', group: 'Jamaah & kegiatan', icon: 'Calendar', permissions: [P.EVENTS_VIEW], description: 'Jadwal, peserta, tiket dan presensi' },
  { path: '/kajian-rutin', label: 'Kajian rutin', group: 'Jamaah & kegiatan', icon: 'CalendarClock', permissions: [P.EVENTS_VIEW], description: 'Jadwal berulang dan absensi mandiri' },
  { path: '/bazaar', label: 'Bazar & tenant', group: 'Jamaah & kegiatan', icon: 'Store', permissions: [P.EVENTS_VIEW], description: 'Tenant, stan dan pembayaran bazar' },
  { path: '/interactions', label: 'Interaksi', group: 'Jamaah & kegiatan', icon: 'MessageSquare', permissions: [P.INTERACTIONS_VIEW], description: 'Riwayat komunikasi jamaah' },
  { path: '/ruang-jamaah/kelola', label: 'Ruang Jamaah', group: 'Jamaah & kegiatan', icon: 'Inbox', permissions: [P.INTERACTIONS_VIEW], description: 'Pertanyaan, saran dan kebutuhan jamaah' },
  { path: '/tasks', label: 'Tugas & tindak lanjut', group: 'Jamaah & kegiatan', icon: 'CheckSquare', permissions: [P.TASKS_VIEW_OWN, P.TASKS_VIEW_ALL], description: 'Penugasan dan agenda tindak lanjut' },
  { path: '/donations', label: 'Donasi & infaq', group: 'Donasi & wakaf', icon: 'HeartHandshake', permissions: [P.DONATIONS_LIST], description: 'Pencatatan dan verifikasi donasi' },
  { path: '/donors-pipeline', label: 'Relasi donatur', group: 'Donasi & wakaf', icon: 'TrendingUp', permissions: [P.DONORS_VIEW], description: 'Tahapan pendampingan donatur' },
  { path: '/waqf', label: 'Wakaf', group: 'Donasi & wakaf', icon: 'Landmark', permissions: [P.WAQF_LIST], description: 'Kasus, tahapan dan dokumen wakaf' },
  { path: '/reports', label: 'Laporan', group: 'Pengelolaan', icon: 'FileBarChart2', permissions: [P.REPORTS_VIEW, P.REPORTS_FINANCE, P.PERSONS_CREATE], description: 'Rekap kegiatan dan keuangan' },
  { path: '/automation', label: 'Komunikasi', group: 'Pengelolaan', icon: 'Send', permissions: [P.BROADCAST_HISTORY, P.BROADCAST_DRAFT], description: 'Broadcast, pengingat dan kampanye email' },
  { path: '/data-quality', label: 'Kualitas data', group: 'Pengelolaan', icon: 'ShieldCheck', permissions: [P.DATA_QUALITY_MANAGE], description: 'Duplikasi dan kelengkapan data jamaah' },
  { path: '/audit', label: 'Log audit', group: 'Pengelolaan', icon: 'History', permissions: [P.AUDIT_VIEW], description: 'Riwayat perubahan dan ekspor data' },
  { path: '/settings', label: 'Akun & pengaturan', group: 'Pengelolaan', icon: 'Settings', permissions: [], description: 'Profil dan kata sandi akun' },
];

export function canOpenDestination(destination: AppDestination, permissions: readonly PermissionCode[]): boolean {
  return destination.permissions.length === 0 || destination.permissions.some((permission) => permissions.includes(permission));
}

export function getDestination(path: string): AppDestination | undefined {
  const pathname = path.split(/[?#]/)[0] || '/';
  return APP_DESTINATIONS.find((item) => item.path === '/' ? pathname === '/' : pathname === item.path || pathname.startsWith(`${item.path}/`));
}

export function canOpenPath(path: string, permissions: readonly PermissionCode[]): boolean {
  const destination = getDestination(path);
  if (!destination || !canOpenDestination(destination, permissions)) return false;
  if (/^\/people\/[^/]+\/?$/.test(path.split(/[?#]/)[0] || '')) {
    return [P.PERSONS_VIEW, P.PERSONS_VIEW_OPERATIONAL].some((p) => permissions.includes(p));
  }
  return true;
}

export function safeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) return '/';
  return getDestination(path) ? path : '/';
}

export type ReportTab = 'executive' | 'donations' | 'waqf' | 'attendance' | 'import_export';
export function canViewReport(tab: ReportTab, permissions: readonly PermissionCode[]): boolean {
  const has = (permission: PermissionCode) => permissions.includes(permission);
  if (tab === 'donations') return has(P.REPORTS_FINANCE);
  if (tab === 'import_export') return has(P.PERSONS_CREATE);
  if (!has(P.REPORTS_VIEW)) return false;
  if (tab === 'executive') return has(P.DONATIONS_VIEW_SUMMARY) || has(P.AUDIT_VIEW);
  if (tab === 'waqf') return has(P.WAQF_VIEW_DETAIL) || has(P.AUDIT_VIEW);
  return true;
}
