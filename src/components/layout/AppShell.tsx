import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useGetIdentity, useLogout, usePermissions } from '@refinedev/core';
import {
  LayoutDashboard,
  IdCard,
  Calendar,
  CheckSquare,
  MessageSquare,
  Plus,
  HeartHandshake,
  Landmark,
  FileBarChart2,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  TrendingUp,
  Store,
  Search,
} from 'lucide-react';
import { UserIdentity } from '../../lib/authProvider';
import { PermissionCode, PERMISSIONS, ROLES } from '@server/permissions/constants';
import { QuickInteractionModal } from '../../features/interactions/QuickInteractionModal';
import { GlobalSearchModal } from '@/components/common/GlobalSearchModal';
import { InactivityAutoLogoutGuard } from '@/components/common/InactivityAutoLogoutGuard';

interface NavGroup {
  category: string;
  items: NavItem[];
}

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionCode;
  badge?: string;
  badgeColor?: string;
  description?: string;
}

const NAV_GROUPS: NavGroup[] = [
  {
    category: 'Utama',
    items: [
      {
        name: 'Beranda Kerja (Dashboard)',
        href: '/',
        icon: LayoutDashboard,
        description: 'Ringkasan Antrean & KPI Amanah',
      },
    ],
  },
  {
    category: 'Layanan Jamaah & Dakwah',
    items: [
      {
        name: 'Kajian, Daurah & Presensi',
        href: '/events',
        icon: Calendar,
        badge: 'Gate Scanner & Kuota',
        badgeColor: 'bg-[#1B4332] text-[#E0B970] border-[#E0B970]/30',
        permission: PERMISSIONS.EVENTS_VIEW,
        description: 'Jadwal, Kuota, Form & Pemindai QR',
      },
      {
        name: 'Bazar & Tenant Daurah',
        href: '/bazaar',
        icon: Store,
        badge: 'War Tempat',
        badgeColor: 'bg-[#0F4C4A] text-teal-200 border-teal-400/30',
        permission: PERMISSIONS.EVENTS_VIEW,
        description: 'Plotting Stand, Denah & Infaq Booth',
      },
      {
        name: 'Direktori Jamaah',
        href: '/people',
        icon: IdCard,
        permission: PERMISSIONS.PERSONS_LIST,
        description: 'Profil 360° Jamaah & Donatur',
      },
      {
        name: 'Riwayat Sapaan',
        href: '/interactions',
        icon: MessageSquare,
        permission: PERMISSIONS.INTERACTIONS_VIEW,
        description: 'Log Chat & Kontak Jamaah',
      },
      {
        name: 'Tugas & Follow-Up',
        href: '/tasks',
        icon: CheckSquare,
        badge: '12',
        badgeColor: 'bg-[#C77A16] text-white border-[#C77A16]',
        permission: PERMISSIONS.TASKS_VIEW_OWN,
        description: 'Agenda Kunjungan & Tindak Lanjut',
      },
    ],
  },
  {
    category: 'Infaq, Wakaf & Keuangan',
    items: [
      {
        name: 'Pengaturan Donasi & Infaq',
        href: '/donations',
        icon: HeartHandshake,
        badge: '7',
        badgeColor: 'bg-[#C77A16] text-white border-[#C77A16]',
        permission: PERMISSIONS.DONATIONS_LIST,
        description: 'Verifikasi Mutasi & Bukti Transfer',
      },
      {
        name: 'Pengaturan & Pipeline Wakaf',
        href: '/waqf',
        icon: Landmark,
        badge: '7 Tahap',
        badgeColor: 'bg-[#B58B3C] text-white border-[#B58B3C]',
        permission: PERMISSIONS.WAQF_LIST,
        description: 'Pengelolaan Aset & Ikrar Wakaf',
      },
      {
        name: 'Pipeline Donatur',
        href: '/donors-pipeline',
        icon: TrendingUp,
        permission: PERMISSIONS.DONATIONS_LIST,
        description: 'Tahapan Stewardship Donatur',
      },
      {
        name: 'Automasi Layanan',
        href: '/automation',
        icon: Sparkles,
        permission: PERMISSIONS.BROADCAST_HISTORY,
        description: 'Broadcast & Reminder Kajian',
      },
      {
        name: 'Laporan Finansial',
        href: '/reports',
        icon: FileBarChart2,
        permission: PERMISSIONS.REPORTS_VIEW,
        description: 'Rekap Infaq, Wakaf & Donatur',
      },
    ],
  },
  {
    category: 'Tata Kelola & Keamanan',
    items: [
      {
        name: 'Kualitas Data',
        href: '/data-quality',
        icon: ShieldCheck,
        permission: PERMISSIONS.DATA_QUALITY_MANAGE,
        description: 'Deteksi Duplikat & Normalisasi',
      },
      {
        name: 'Log Audit Sistem',
        href: '/audit',
        icon: History,
        permission: PERMISSIONS.AUDIT_VIEW,
        description: 'Rekam Jejak Keamanan & Mutasi',
      },
      {
        name: 'Pengaturan Yayasan',
        href: '/settings',
        icon: Settings,
        badge: 'Admin',
        badgeColor: 'bg-white/20 text-[#E0B970] border-[#E0B970]/40',
        permission: PERMISSIONS.SYSTEM_CONFIGURE,
        description: 'Rekening BSI, Profil & Operasional',
      },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '': 'Beranda Kerja (Dashboard)',
  'people': 'Direktori Jamaah & Donatur',
  'events': 'Kajian, Daurah & Presensi',
  'bazaar': 'Bazar & Tenant Daurah',
  'interactions': 'Riwayat Sapaan & Kontak',
  'tasks': 'Agenda Tugas & Follow-Up',
  'donations': 'Verifikasi Donasi & Infaq',
  'donors-pipeline': 'Pipeline Siklus Donatur',
  'waqf': 'Pipeline Amanah Wakaf (7 Tahap)',
  'automation': 'Automasi Layanan WhatsApp',
  'reports': 'Laporan Finansial & Rekap',
  'data-quality': 'Kualitas & Kebersihan Data',
  'audit': 'Log Audit & Keamanan Sistem',
  'settings': 'Pengaturan Sistem & Rekening Yayasan',
};

function getRoleLabel(roles?: string[]): string {
  if (!roles || roles.length === 0) return 'STAFF AMIL';
  if (roles.includes(ROLES.CRM_ADMIN) || roles.includes('crm_admin' as any)) return 'CRM ADMIN';
  if (roles.includes('keuangan')) return 'FINANCE';
  if (roles.includes('wakaf_officer')) return 'WAKAF OFFICER';
  if (roles.includes('cs_officer')) return 'CS OFFICER';
  if (roles.includes('data_steward')) return 'DATA STEWARD';
  if (roles.includes('event_admin')) return 'ADMIN KAJIAN';
  const firstRole = roles[0];
  return firstRole ? firstRole.replace('_', ' ').toUpperCase() : 'STAFF';
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickInteractionOpen, setQuickInteractionOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('yts_sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  const location = useLocation();
  const { data: user } = useGetIdentity<UserIdentity>();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const { mutate: logout } = useLogout();

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('yts_sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar & Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const roleLabel = getRoleLabel(user?.roles);
  const currentPathSegment = location.pathname.split('/')[1] || '';
  const currentPageTitle = PAGE_TITLES[currentPathSegment] || currentPathSegment.replace('-', ' ');

  return (
    <InactivityAutoLogoutGuard timeoutMinutes={30} warningSeconds={60}>
      <div className="min-h-screen flex bg-[#F7F4EC] font-sans text-[#1C2321] antialiased selection:bg-[#B58B3C]/30 selection:text-[#14352A]">
        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-[#0F3A2E]/60 backdrop-blur-xs lg:hidden transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* 1. MAIN SIDEBAR (Mockup 1a Visuals + Full Categorized Functional Menus) */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 bg-[#14352A] text-white flex flex-col transition-all duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:translate-x-0 h-[100dvh] max-h-[100dvh] overflow-hidden ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72 shrink-0 border-r border-[#1B4332]/40 shadow-2xl`}
        >
          {/* Brand Header */}
          <div className="pt-4 px-4 pb-3.5 flex items-center justify-between shrink-0 border-b border-white/10">
            {isCollapsed ? (
              <div className="w-full flex items-center justify-center" title="Yayasan Tarbiyah Sunnah">
                <div className="w-8.5 h-8.5 rounded-xl bg-white p-1 shadow-xs border border-white/20 flex items-center justify-center overflow-hidden">
                  <img src="/logo.png" alt="Logo YTS" className="w-full h-full object-contain" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-xl bg-white p-1 shadow-xs border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src="/logo.png" alt="Logo Tarbiyah Sunnah" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="font-display font-bold text-[13px] text-white leading-none tracking-tight">
                    CRM YTS
                  </div>
                  <div className="font-mono font-medium text-[9px] text-[#E0B970] tracking-widest mt-1 uppercase">
                    RUANG KENDALI AMANAH
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-white/60 hover:text-white p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Action Button (Expanded only) */}
          {!isCollapsed && (
            <div className="px-3.5 pt-3.5 pb-1 shrink-0">
              <button
                onClick={() => setQuickInteractionOpen(true)}
                className="w-full py-2 px-3 bg-[#B58B3C] hover:bg-[#A37B30] text-[#14352A] font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Catat Sapaan Jamaah</span>
              </button>
            </div>
          )}

          {/* Navigation Menu Groups (Full Features Preserved) */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 sidebar-scrollbar select-none">
            {NAV_GROUPS.map((group) => {
              const isAdmin =
                user?.roles?.includes(ROLES.CRM_ADMIN) ||
                user?.roles?.includes('crm_admin' as any) ||
                permissions.includes(PERMISSIONS.SYSTEM_CONFIGURE) ||
                permissions.includes(PERMISSIONS.USERS_MANAGE);

              const visibleItems = group.items.filter(
                (item) => isAdmin || !item.permission || permissions.includes(item.permission)
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={group.category} className="space-y-1">
                  {/* Category Header */}
                  {!isCollapsed ? (
                    <h3 className="px-2.5 text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#E0B970]/80">
                      {group.category}
                    </h3>
                  ) : (
                    <div className="border-t border-white/10 my-2" />
                  )}

                  {/* Nav Items */}
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive =
                        item.href === '/'
                          ? location.pathname === '/'
                          : location.pathname.startsWith(item.href);

                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          title={isCollapsed ? `${item.name}${item.description ? ` (${item.description})` : ''}` : undefined}
                          className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-all ${
                            isActive
                              ? 'bg-[#B58B3C]/20 text-white font-bold ring-1 ring-[#B58B3C]/40 shadow-xs'
                              : 'text-white/75 hover:text-white hover:bg-white/7 font-medium'
                          } ${isCollapsed ? 'justify-center py-2.5' : ''}`}
                        >
                          <item.icon
                            className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                              isActive ? 'text-[#E0B970]' : 'text-white/60'
                            }`}
                          />

                          {!isCollapsed && (
                            <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                              <div className="min-w-0">
                                <span className="block truncate text-[12.5px] leading-snug">{item.name}</span>
                                {item.description && (
                                  <span className="block truncate text-[10.5px] text-white/45 font-normal leading-tight">
                                    {item.description}
                                  </span>
                                )}
                              </div>

                              {item.badge && (
                                <span
                                  className={`px-1.5 py-0.5 text-[9.5px] font-mono font-bold uppercase tracking-wider rounded-md border shrink-0 ${
                                    item.badgeColor || 'bg-white/15 text-white border-white/20'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Hover Tooltip in Collapsed Mode */}
                          {isCollapsed && (
                            <div className="hidden group-hover:block fixed left-22 z-50 ml-2 px-3 py-1.5 bg-[#14352A] text-white text-xs font-semibold rounded-lg shadow-xl border border-[#B58B3C]/30 whitespace-nowrap pointer-events-none">
                              <p className="font-bold text-white">{item.name}</p>
                              {item.description && <p className="text-[10px] text-[#E0B970]">{item.description}</p>}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* User Profile Bottom Bar (Mockup 1a with Official Logo Picture) */}
          <div className="p-3.5 px-4 border-t border-white/10 flex items-center justify-between shrink-0 bg-[#14352A]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-white p-0.5 border border-white/30 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden" title={user?.name || 'Amil Tarbiyah Sunnah'}>
                <img
                  src="/logo.png"
                  alt="Profil Amil YTS"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <div className="font-semibold text-[12px] text-white truncate leading-tight font-display">
                    {user?.name || 'Rahmat Hidayat'}
                  </div>
                  <div className="font-mono font-medium text-[9.5px] text-[#E0B970] tracking-wider mt-0.5 uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E0B970] inline-block shrink-0" />
                    <span className="truncate">{roleLabel}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Logout & Collapse Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => logout()}
                title="Keluar dari Sistem (Logout)"
                className="p-1.5 text-white/50 hover:text-rose-300 hover:bg-white/10 transition-colors rounded-lg"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <button
                onClick={toggleCollapse}
                title={isCollapsed ? 'Perluas Menu (Ctrl+B)' : 'Ciutkan Menu (Ctrl+B)'}
                className="hidden lg:flex p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors rounded-lg"
              >
                {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </aside>

        {/* 2. MAIN CONTENT AREA WITH RICH TOPBAR */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F7F4EC]">
          {/* TopBar (Height: 60px, Background: #FBF9F4, Border: rgba(27,67,50,.12)) */}
          <header className="h-[60px] bg-[#FBF9F4] border-b border-[#1B4332]/12 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs shrink-0">
            <div className="flex items-center gap-3">
              {/* Mobile Drawer Trigger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-1.5 text-[#3D4A44] hover:text-[#14352A] rounded-lg hover:bg-[#F2EEE4]"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Breadcrumb Navigation */}
              <nav className="flex items-center gap-2 text-xs sm:text-sm text-[#6B7A72]">
                <Link to="/" className="hover:text-[#14352A] font-bold transition-colors">CRM YTS</Link>
                <ChevronRight className="w-3.5 h-3.5 text-[#8A9690]" />
                <span className="font-bold text-[#1C2321] truncate max-w-[160px] sm:max-w-none">
                  {currentPageTitle}
                </span>
              </nav>
            </div>

            {/* Center: Global Search Command Palette Bar (⌘K) */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="hidden md:flex items-center gap-2.5 h-9 px-3 bg-[#F2EEE4] hover:bg-[#EAE4D6] border border-[#1B4332]/12 rounded-lg text-[12.5px] text-[#8A9690] w-52 sm:w-64 lg:w-80 transition-colors cursor-pointer select-none"
            >
              <Search className="w-3.5 h-3.5 text-[#6B7A72]" />
              <span className="truncate">Cari jamaah, donasi, wakaf…</span>
              <span className="ml-auto font-mono text-[10px] font-medium text-[#A8B2AC] px-1 py-0.2 rounded bg-white/80 border border-[#1B4332]/10">
                ⌘K
              </span>
            </button>

            {/* Right Topbar Quick Navigation Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* 1. Kelola Kajian */}
              <Link
                to="/events"
                title="Kelola Jadwal Kajian, Kuota, Parkir & Form Builder"
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all hidden xl:flex items-center gap-1.5 border shadow-2xs ${
                  location.pathname.startsWith('/events')
                    ? 'bg-[#1B4332] text-white border-[#1B4332]'
                    : 'bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1F2A44] border-[#1B4332]/14'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Kajian</span>
              </Link>

              {/* 2. Kelola Donasi */}
              <Link
                to="/donations"
                title="Kelola & Verifikasi Donasi Infaq"
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all hidden xl:flex items-center gap-1.5 border shadow-2xs ${
                  location.pathname.startsWith('/donations') || location.pathname.startsWith('/donors-pipeline')
                    ? 'bg-[#1B4332] text-white border-[#1B4332]'
                    : 'bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1F2A44] border-[#1B4332]/14'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Donasi</span>
              </Link>

              {/* 3. Kelola Wakaf */}
              <Link
                to="/waqf"
                title="Kelola 7 Tahapan Pipeline Wakaf"
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all hidden xl:flex items-center gap-1.5 border shadow-2xs ${
                  location.pathname.startsWith('/waqf')
                    ? 'bg-[#1B4332] text-white border-[#1B4332]'
                    : 'bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1F2A44] border-[#1B4332]/14'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Wakaf</span>
              </Link>

              {/* 4. Pengaturan */}
              <Link
                to="/settings"
                title="Pengaturan Yayasan, Rekening BSI & Webhook"
                className="p-1.5 text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4] rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
              </Link>

              <div className="h-4 w-px bg-[#1B4332]/14 mx-0.5 hidden sm:block" />

              {/* 5. Quick Interaksi & Tindak Lanjut */}
              <button
                onClick={() => setQuickInteractionOpen(true)}
                className="h-[34px] px-2.5 sm:px-3 rounded-lg border border-[#1B4332]/16 bg-[#FBF9F4] hover:bg-[#F2EEE4] font-semibold text-[12px] text-[#1F2A44] transition-all shadow-2xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-[#1B4332]" />
                <span className="hidden sm:inline">Interaksi</span>
              </button>

              <Link
                to="/tasks"
                className="h-[34px] px-3 sm:px-3.5 rounded-lg bg-[#1B4332] hover:bg-[#14352A] text-white font-semibold text-[12px] transition-all shadow-xs flex items-center gap-1.5 active:scale-98"
              >
                <Plus className="w-3.5 h-3.5 text-[#E0B970]" />
                <span>Tindak Lanjut</span>
              </Link>

              {/* 6. User Profile Pill in Topbar */}
              <Link
                to="/settings"
                title={`Profil: ${user?.name || 'Amil YTS'} (${roleLabel})`}
                className="flex items-center gap-2 py-1 pl-1 pr-2.5 rounded-xl bg-[#F2EEE4] hover:bg-[#EAE4D6] border border-[#1B4332]/12 transition-all shadow-2xs ml-1"
              >
                <div className="w-7 h-7 rounded-full bg-white p-0.5 border border-[#1B4332]/20 shadow-2xs overflow-hidden flex items-center justify-center shrink-0">
                  <img src="/logo.png" alt="Profil Logo" className="w-full h-full object-contain rounded-full" />
                </div>
                <span className="text-xs font-bold text-[#1C2321] hidden md:inline truncate max-w-[120px]">
                  {user?.name?.split(' ')[0] || 'Amil'}
                </span>
              </Link>
            </div>
          </header>

          {/* Main Body Canvas */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 max-w-[1400px] w-full mx-auto">
            {children}
          </main>
        </div>

        {/* Global Quick Interaction Modal */}
        <QuickInteractionModal
          isOpen={quickInteractionOpen}
          onClose={() => setQuickInteractionOpen(false)}
        />

        {/* Global Search Command Palette Modal */}
        <GlobalSearchModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
        />
      </div>
    </InactivityAutoLogoutGuard>
  );
};
