import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useGetIdentity, useLogout, usePermissions } from '@refinedev/core';
import {
  LayoutDashboard,
  Users,
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
} from 'lucide-react';
import { UserIdentity } from '../../lib/authProvider';
import { PermissionCode, PERMISSIONS, ROLES } from '@server/permissions/constants';
import { QuickInteractionModal } from '../../features/interactions/QuickInteractionModal';
import { BrandLogo, BrandEmblem } from '@/components/common/BrandLogo';

interface NavGroup {
  category: string;
  items: NavItem[];
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionCode;
  badge?: string;
  description?: string;
}

const NAV_GROUPS: NavGroup[] = [
  {
    category: 'Utama',
    items: [
      {
        name: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        description: 'Ringkasan KPI & Aktivitas',
      },
    ],
  },
  {
    category: 'Layanan Jamaah & Dakwah',
    items: [
      {
        name: 'Pengaturan Event & Kajian',
        href: '/events',
        icon: Calendar,
        badge: 'Form & Kuota',
        permission: PERMISSIONS.EVENTS_VIEW,
        description: 'Atur Kuota, Parkir & Form Builder',
      },
      {
        name: 'Direktori Jamaah',
        href: '/people',
        icon: Users,
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
        badge: 'Infaq',
        permission: PERMISSIONS.DONATIONS_LIST,
        description: 'Verifikasi Mutasi & Bukti Transfer',
      },
      {
        name: 'Pengaturan & Pipeline Wakaf',
        href: '/waqf',
        icon: Landmark,
        badge: '7 Tahap',
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
        permission: PERMISSIONS.SYSTEM_CONFIGURE,
        description: 'Rekening BSI, Profil & Operasional',
      },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '': 'Dashboard Utama',
  'people': 'Direktori Jamaah & Donatur',
  'events': 'Pengelolaan Kajian, Kuota & Form Builder',
  'interactions': 'Riwayat Sapaan & Kontak',
  'tasks': 'Agenda Tugas & Follow-Up',
  'donations': 'Verifikasi Infaq & Donasi',
  'donors-pipeline': 'Pipeline Siklus Donatur',
  'waqf': 'Pipeline Amanah Wakaf',
  'automation': 'Automasi Layanan WhatsApp',
  'reports': 'Laporan Finansial & Rekap',
  'data-quality': 'Kualitas & Kebersihan Data',
  'audit': 'Log Audit & Keamanan Sistem',
  'settings': 'Pengaturan Sistem & Rekening Yayasan',
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickInteractionOpen, setQuickInteractionOpen] = useState(false);
  
  // Collapse sidebar state persisted in localStorage
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

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#07241d] text-white flex flex-col transition-all duration-300 ease-in-out lg:static lg:translate-x-0 border-r border-emerald-950/80 shadow-xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-emerald-900/60 bg-[#051c17]">
          {isCollapsed ? (
            <div className="w-full flex items-center justify-center">
              <div className="p-1 rounded-xl bg-white/95 shadow-xs border border-white/20">
                <BrandEmblem className="w-7 h-7" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-hidden">
              <BrandLogo variant="horizontal" theme="dark" emblemSize="w-8 h-8" badge="PROD" subtitle="Tarbiyah Sunnah" />
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Perluas Menu (Ctrl+B)' : 'Ciutkan Menu (Ctrl+B)'}
            className="hidden lg:flex p-1.5 text-emerald-300/70 hover:text-white hover:bg-emerald-900/60 rounded-lg transition-colors shrink-0"
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-emerald-300 hover:text-white p-1.5 rounded-lg hover:bg-emerald-900/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Button (Expanded only) */}
        {!isCollapsed && (
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={() => setQuickInteractionOpen(true)}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 border border-emerald-400/30"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Sapaan Jamaah</span>
            </button>
          </div>
        )}

        {/* Navigation Menu Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-thin scrollbar-thumb-emerald-800">
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
                  <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400/70 select-none">
                    {group.category}
                  </h3>
                ) : (
                  <div className="border-t border-emerald-900/50 my-2" />
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
                        className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-emerald-600/90 text-white shadow-sm ring-1 ring-emerald-400/30 font-bold'
                            : 'text-emerald-100/80 hover:bg-emerald-900/50 hover:text-white'
                        } ${isCollapsed ? 'justify-center py-2.5' : ''}`}
                      >
                        <item.icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-white' : 'text-emerald-400'
                          }`}
                        />

                        {!isCollapsed && (
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                            <div className="min-w-0">
                              <span className="block truncate text-sm leading-snug">{item.name}</span>
                              {item.description && (
                                <span className="block truncate text-[11px] text-emerald-300/60 font-normal leading-tight">
                                  {item.description}
                                </span>
                              )}
                            </div>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide rounded bg-emerald-700/80 text-emerald-100 border border-emerald-500/30 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Hover Tooltip in Collapsed Mode */}
                        {isCollapsed && (
                          <div className="hidden group-hover:block fixed left-20 z-50 ml-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap pointer-events-none">
                            <p className="font-bold text-white">{item.name}</p>
                            {item.description && <p className="text-[10px] text-emerald-300">{item.description}</p>}
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

        {/* User Profile & Footer */}
        <div className="p-3 border-t border-emerald-900/60 bg-[#051c17]">
          <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div
                title={user?.name || 'Staf YTS'}
                className="w-10 h-10 rounded-full bg-emerald-800 border-2 border-emerald-500/40 flex items-center justify-center font-bold text-sm text-white uppercase shrink-0 shadow-inner"
              >
                {user?.name ? user.name.charAt(0) : 'U'}
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name || 'Staf YTS'}</p>
                  <p className="text-xs text-emerald-300/80 truncate mt-0.5">
                    {user?.roles && user.roles.length > 0 ? user.roles.join(', ') : 'Operasional'}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => logout()}
              title="Keluar dari Sistem (Logout)"
              className="p-2 text-emerald-300/70 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition-colors shrink-0"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Topbar Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Mobile Drawer Trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-sm text-slate-500">
              <Link to="/" className="hover:text-emerald-800 font-medium transition-colors">CRM YTS</Link>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-900">
                {PAGE_TITLES[location.pathname.split('/')[1] || ''] || location.pathname.split('/')[1]?.replace('-', ' ')}
              </span>
            </nav>
          </div>

          {/* Right Topbar Actions */}
          <div className="flex items-center gap-2">
            {/* 1. Kelola Kajian & Presensi */}
            <Link
              to="/events"
              title="Kelola Jadwal Kajian, Kuota, Parkir & Form Builder"
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                location.pathname.startsWith('/events')
                  ? 'bg-teal-800 text-white border-teal-900 shadow-xs'
                  : 'bg-teal-50 hover:bg-teal-100 text-teal-950 border-teal-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <span className="hidden sm:inline">Kelola Kajian</span>
            </Link>

            {/* 2. Kelola Donasi & Infaq */}
            <Link
              to="/donations"
              title="Kelola & Verifikasi Donasi Infaq"
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                location.pathname.startsWith('/donations') || location.pathname.startsWith('/donors-pipeline')
                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-200'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Kelola Donasi</span>
            </Link>

            {/* 3. Kelola Wakaf */}
            <Link
              to="/waqf"
              title="Kelola 7 Tahapan Pipeline Wakaf"
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                location.pathname.startsWith('/waqf')
                  ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden md:inline">Kelola Wakaf</span>
            </Link>

            {/* 4. Pengaturan Yayasan */}
            <Link
              to="/settings"
              title="Pengaturan Rekening Bank BSI & Profil Yayasan"
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                location.pathname.startsWith('/settings')
                  ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span className="hidden xl:inline text-xs font-semibold">Pengaturan</span>
            </Link>

            {/* 5. Quick Action Sapaan */}
            <button
              onClick={() => setQuickInteractionOpen(true)}
              className="py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden lg:inline">Catat Sapaan</span>
            </button>
          </div>
        </header>

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Quick Interaction Modal */}
      <QuickInteractionModal
        isOpen={quickInteractionOpen}
        onClose={() => setQuickInteractionOpen(false)}
      />
    </div>
  );
};
