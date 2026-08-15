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
    <div className="min-h-screen flex bg-[#fbfaf6] font-sans text-surface-900 antialiased selection:bg-brand-100 selection:text-brand-900">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-surface-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#122214] text-white flex flex-col transition-all duration-300 ease-in-out lg:static lg:translate-x-0 border-r border-[#1f3622] shadow-2xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-[#1f3622] bg-[#0c180e]">
          {isCollapsed ? (
            <div className="w-full flex items-center justify-center">
              <div className="p-1.5 rounded-xl bg-[#fbfaf6] shadow-xs border border-cream-300">
                <BrandEmblem className="w-7 h-7" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-hidden">
              <BrandLogo variant="horizontal" theme="dark" emblemSize="w-8 h-8" badge="PROD" subtitle="Sistem CRM & Dakwah" />
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Perluas Menu (Ctrl+B)' : 'Ciutkan Menu (Ctrl+B)'}
            className="hidden lg:flex p-1.5 text-surface-400 hover:text-white hover:bg-[#1f3622] rounded-lg transition-colors shrink-0"
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-surface-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1f3622]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Button (Expanded only) */}
        {!isCollapsed && (
          <div className="px-3.5 pt-4 pb-1.5">
            <button
              onClick={() => setQuickInteractionOpen(true)}
              className="w-full py-2.5 px-3 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 border border-brand-400/40"
            >
              <Plus className="w-4 h-4 text-gold-300" />
              <span>Catat Sapaan Jamaah</span>
            </button>
          </div>
        )}

        {/* Navigation Menu Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-brand-950">
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
                  <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-[#8fad92] select-none">
                    {group.category}
                  </h3>
                ) : (
                  <div className="border-t border-[#1f3622] my-2" />
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
                            ? 'bg-brand-700/80 text-white shadow-sm ring-1 ring-brand-400/50 font-bold'
                            : 'text-[#bfd9c1] hover:bg-[#1c331e] hover:text-white'
                        } ${isCollapsed ? 'justify-center py-2.5' : ''}`}
                      >
                        <item.icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-gold-400' : 'text-brand-400'
                          }`}
                        />

                        {!isCollapsed && (
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                            <div className="min-w-0">
                              <span className="block truncate text-sm leading-snug">{item.name}</span>
                              {item.description && (
                                <span className="block truncate text-[11px] text-[#93ba97] font-normal leading-tight">
                                  {item.description}
                                </span>
                              )}
                            </div>
                            {item.badge && (
                              <span
                                className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full shadow-2xs shrink-0 border ${
                                  item.badge === 'Infaq'
                                    ? 'bg-gold-500/20 text-gold-300 border-gold-400/40'
                                    : item.badge === '7 Tahap'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                    : 'bg-brand-800 text-brand-200 border-brand-500/40'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Hover Tooltip in Collapsed Mode */}
                        {isCollapsed && (
                          <div className="hidden group-hover:block fixed left-20 z-50 ml-2 px-3 py-1.5 bg-surface-900 text-white text-xs font-semibold rounded-lg shadow-xl border border-surface-700 whitespace-nowrap pointer-events-none">
                            <p className="font-bold text-white">{item.name}</p>
                            {item.description && <p className="text-[10px] text-gold-300">{item.description}</p>}
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
        <div className="p-3 border-t border-[#1f3622] bg-[#0c180e]">
          <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div
                title={user?.name || 'Staf YTS'}
                className="w-9 h-9 rounded-full bg-brand-700 border-2 border-brand-500/50 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0 shadow-inner"
              >
                {user?.name ? user.name.charAt(0) : 'U'}
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white truncate leading-tight">{user?.name || 'Staf YTS'}</p>
                  <p className="text-[11px] text-[#93ba97] truncate mt-0.5 font-medium">
                    {user?.roles && user.roles.length > 0 ? user.roles.join(', ') : 'Operasional'}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => logout()}
              title="Keluar dari Sistem (Logout)"
              className="p-1.5 text-surface-400 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#fbfaf6]">
        {/* Topbar Header */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-cream-300 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Mobile Drawer Trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-surface-600 hover:text-surface-900 rounded-lg hover:bg-cream-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-sm text-surface-500">
              <Link to="/" className="hover:text-brand-900 font-bold transition-colors">CRM YTS</Link>
              <ChevronRight className="w-4 h-4 text-surface-400" />
              <span className="font-black text-brand-950">
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
                  ? 'bg-brand-800 text-white border-brand-900 shadow-xs'
                  : 'bg-cream-100 hover:bg-cream-200 text-brand-950 border-cream-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-brand-700" />
              <span className="hidden sm:inline">Kelola Kajian</span>
            </Link>

            {/* 2. Kelola Donasi & Infaq */}
            <Link
              to="/donations"
              title="Kelola & Verifikasi Donasi Infaq"
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                location.pathname.startsWith('/donations') || location.pathname.startsWith('/donors-pipeline')
                  ? 'bg-brand-800 text-white border-brand-900 shadow-xs'
                  : 'bg-cream-100 hover:bg-cream-200 text-brand-950 border-cream-300'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5 text-brand-700" />
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
              <span className="hidden sm:inline">Kelola Wakaf</span>
            </Link>

            {/* 4. Pengaturan */}
            <Link
              to="/settings"
              title="Pengaturan Yayasan, Rekening BSI & Webhook"
              className="p-2 text-surface-500 hover:text-brand-900 hover:bg-cream-100 rounded-xl transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <div className="h-4 w-px bg-cream-300 mx-1 hidden sm:block" />

            {/* 5. Catat Sapaan Quick Action */}
            <button
              onClick={() => setQuickInteractionOpen(true)}
              className="py-1.5 px-3 bg-gradient-to-r from-gold-400 to-amber-500 hover:from-gold-300 hover:to-amber-400 text-amber-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 border border-amber-500/40 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Catat Sapaan</span>
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
