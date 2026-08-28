import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useGetIdentity, useLogout, usePermissions } from '@refinedev/core';
import {
  IdCard,
  Calendar,
  CheckSquare,
  MessageSquare,
  Plus,
  Coins,
  Building2,
  TrendingUp,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Store,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { UserIdentity } from '../../lib/authProvider';
import { PermissionCode, PERMISSIONS, ROLES } from '@server/permissions/constants';
import { QuickInteractionModal } from '../../features/interactions/QuickInteractionModal';
import { GlobalSearchModal } from '@/components/common/GlobalSearchModal';
import { InactivityAutoLogoutGuard } from '@/components/common/InactivityAutoLogoutGuard';

export interface NavMenuItem {
  name: string;
  href: string;
  badge?: string | number;
  badgeColor?: string;
  permission?: PermissionCode;
}

const MAIN_NAV_ITEMS: NavMenuItem[] = [
  { name: 'Beranda Kerja', href: '/' },
  { name: 'Jamaah', href: '/people' },
  { name: 'Tindak Lanjut', href: '/tasks', badge: '12', badgeColor: 'bg-[#C77A16]' },
  { name: 'Donasi', href: '/donations', badge: '7', badgeColor: 'bg-[#C77A16]' },
  { name: 'Wakaf', href: '/waqf' },
  { name: 'Kajian', href: '/events' },
  { name: 'Bazar UMKM', href: '/bazaar' },
  { name: 'Kualitas Data', href: '/data-quality' },
];

const GOVERNANCE_NAV_ITEMS: NavMenuItem[] = [
  { name: 'Audit Log', href: '/audit', permission: PERMISSIONS.AUDIT_VIEW },
  { name: 'Role & Permission', href: '/settings', permission: PERMISSIONS.SYSTEM_CONFIGURE },
];

function getInitials(name?: string): string {
  if (!name) return 'RH';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getRoleLabel(roles?: string[]): string {
  if (!roles || roles.length === 0) return 'STAFF AMIL';
  if (roles.includes(ROLES.CRM_ADMIN) || roles.includes('crm_admin' as any)) return 'CRM ADMIN';
  if (roles.includes('keuangan')) return 'FINANCE';
  if (roles.includes('wakaf_officer')) return 'WAKAF OFFICER';
  if (roles.includes('cs_officer')) return 'CS OFFICER';
  if (roles.includes('data_steward')) return 'DATA STEWARD';
  if (roles.includes('event_admin')) return 'ADMIN KAJIAN';
  return roles[0].replace('_', ' ').toUpperCase();
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

  const initials = getInitials(user?.name);
  const roleLabel = getRoleLabel(user?.roles);

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

        {/* 1. MAIN SIDEBAR (Mockup 1a - Width: 224px, Background: #14352A) */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 bg-[#14352A] text-white flex flex-col transition-all duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:translate-x-0 h-[100dvh] max-h-[100dvh] overflow-hidden ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${isCollapsed ? 'lg:w-18' : 'lg:w-[224px]'} w-[224px] shrink-0 border-r border-[#1B4332]/40 shadow-xl`}
        >
          {/* Brand Header */}
          <div className="pt-4.5 px-4.5 pb-5 flex items-center justify-between shrink-0">
            {isCollapsed ? (
              <div className="w-full flex items-center justify-center">
                <div className="w-8 h-8 rounded-lg bg-[#B58B3C] flex items-center justify-center font-display font-extrabold text-sm text-[#14352A] shadow-xs">
                  Y
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-7.5 h-7.5 rounded-lg bg-[#B58B3C] flex items-center justify-center font-display font-extrabold text-[13px] text-[#14352A] shadow-xs shrink-0">
                  Y
                </div>
                <div>
                  <div className="font-display font-bold text-[12.5px] text-white leading-none tracking-tight">
                    CRM YTS
                  </div>
                  <div className="font-mono font-medium text-[9.5px] text-white/45 tracking-widest mt-1">
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

          {/* Navigation Menu (Mockup 1a List) */}
          <nav className="flex-1 overflow-y-auto px-2.5 space-y-0.5 sidebar-scrollbar select-none">
            {MAIN_NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] transition-colors font-display ${
                    isActive
                      ? 'bg-[#B58B3C]/18 text-white font-semibold'
                      : 'text-white/72 hover:text-white hover:bg-white/5 font-medium'
                  } ${isCollapsed ? 'justify-center py-2.5' : ''}`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isActive ? 'bg-[#E0B970]' : 'bg-white/30'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </span>

                  {!isCollapsed && item.badge && (
                    <span
                      className={`font-mono text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0 ${
                        item.badgeColor ? `${item.badgeColor} text-white` : 'text-white/40'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="h-px bg-white/10 my-3 mx-2" />

            {/* Governance Section */}
            {GOVERNANCE_NAV_ITEMS.map((item) => {
              const isActive = location.pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] transition-colors font-display ${
                    isActive
                      ? 'bg-[#B58B3C]/18 text-white font-semibold'
                      : 'text-white/55 hover:text-white hover:bg-white/5 font-medium'
                  } ${isCollapsed ? 'justify-center py-2.5' : ''}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActive ? 'bg-[#E0B970]' : 'bg-white/20'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Profile Bottom Bar (Mockup 1a) */}
          <div className="p-3.5 px-4 border-t border-white/10 flex items-center justify-between shrink-0 bg-[#14352A]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-white/14 flex items-center justify-center font-display font-semibold text-[11px] text-white shrink-0">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <div className="font-semibold text-[11.5px] text-white truncate leading-tight font-display">
                    {user?.name || 'Rahmat Hidayat'}
                  </div>
                  <div className="font-mono font-medium text-[9.5px] text-[#E0B970] tracking-wider mt-0.5 uppercase">
                    {roleLabel}
                  </div>
                </div>
              )}
            </div>

            {/* Logout & Collapse Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => logout()}
                title="Keluar dari Sistem (Logout)"
                className="p-1 text-white/50 hover:text-rose-300 transition-colors rounded"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={toggleCollapse}
                title={isCollapsed ? 'Perluas Menu (Ctrl+B)' : 'Ciutkan Menu (Ctrl+B)'}
                className="hidden lg:flex p-1 text-white/50 hover:text-white transition-colors rounded"
              >
                {isCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </aside>

        {/* 2. MAIN CONTENT AREA WITH MOCKUP 1a TOPBAR */}
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

              {/* Search Box Trigger (Mockup 1a - max-w: 380px, height: 36px, bg: #F2EEE4) */}
              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                className="flex items-center gap-2.5 h-9 px-3 bg-[#F2EEE4] hover:bg-[#EAE4D6] border border-[#1B4332]/12 rounded-lg text-[12.5px] text-[#8A9690] w-52 sm:w-72 lg:w-95 transition-colors cursor-pointer select-none"
              >
                <div className="w-2.5 h-2.5 rounded-full border border-[#6B7A72] shrink-0" />
                <span className="truncate">Cari jamaah, donasi, atau case wakaf…</span>
                <span className="ml-auto font-mono text-[10px] font-medium text-[#A8B2AC] px-1 py-0.2 rounded bg-white/80 border border-[#1B4332]/10">
                  ⌘K
                </span>
              </button>
            </div>

            {/* Right Quick Actions (Mockup 1a) */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setQuickInteractionOpen(true)}
                className="h-[34px] px-3 rounded-lg border border-[#1B4332]/16 bg-[#FBF9F4] hover:bg-[#F2EEE4] font-semibold text-[12px] text-[#1F2A44] transition-all shadow-2xs flex items-center gap-1.5"
              >
                <span>+ Interaksi</span>
              </button>

              <Link
                to="/tasks"
                className="h-[34px] px-3.5 rounded-lg bg-[#1B4332] hover:bg-[#14352A] text-white font-semibold text-[12px] transition-all shadow-xs flex items-center gap-1.5 active:scale-98"
              >
                <span>+ Tindak Lanjut</span>
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
