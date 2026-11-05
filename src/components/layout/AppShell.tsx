import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {useQueryClient} from '@tanstack/react-query';
import { useGetIdentity, useLogout, usePermissions } from '@refinedev/core';
import { Calendar, CalendarClock, CheckSquare, ChevronRight, ExternalLink, FileBarChart2, HeartHandshake, History, IdCard, Inbox, Landmark, LayoutDashboard, LogOut, Menu, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Search, Send, Settings, ShieldCheck, Store, TrendingUp, X } from 'lucide-react';
import type { UserIdentity } from '@/lib/authProvider';
import { PERMISSIONS, type PermissionCode } from '@server/permissions/constants';
import { APP_DESTINATIONS, canOpenDestination, getDestination, ROLE_LABELS } from '@server/permissions/navigation';
import { QuickInteractionModal } from '@/features/interactions/QuickInteractionModal';
import { GlobalSearchModal } from '@/components/common/GlobalSearchModal';
import { InactivityAutoLogoutGuard } from '@/components/common/InactivityAutoLogoutGuard';
import { BrandEmblem } from '@/components/common/BrandLogo';
import './app-shell.css';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { Calendar, CalendarClock, CheckSquare, FileBarChart2, HeartHandshake, History, IdCard, Inbox, Landmark, LayoutDashboard, MessageSquare, Send, Settings, ShieldCheck, Store, TrendingUp };
const GROUPS = ['Ringkasan', 'Jamaah & kegiatan', 'Donasi & wakaf', 'Pengelolaan'] as const;

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate=useNavigate();
  const queryClient=useQueryClient();
  const interactionSaved=(result:any)=>{
    if(!result?.interaction?.id)return;
    void queryClient.invalidateQueries({queryKey:['persons','profile',result.interaction.personId]});
    navigate('/interactions?interactionId='+result.interaction.id+'&personId='+result.interaction.personId);
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('yts_sidebar_collapsed') === 'true');
  const location = useLocation();
  const { data: user } = useGetIdentity<UserIdentity>();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const { mutate: logout } = useLogout();
  const menuRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const canInteract = permissions.includes(PERMISSIONS.INTERACTIONS_CREATE) && permissions.includes(PERMISSIONS.PERSONS_LIST);
  const destinations = APP_DESTINATIONS.filter((item) => canOpenDestination(item, permissions));
  const current = getDestination(location.pathname);
  useEffect(() => {
    const previous = document.title;
    document.title = `${current?.label || 'Ruang kerja'} | YTS`;
    return () => { document.title = previous; };
  }, [current?.label]);
  const role = user?.roles?.map((code) => ROLE_LABELS[code]).filter(Boolean).join(' · ') || 'Pengurus YTS';
  const initials = (user?.fullName || user?.name || 'YTS').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const toggleCollapsed = () => setCollapsed((previous) => { localStorage.setItem('yts_sidebar_collapsed', String(!previous)); return !previous; });

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen((value) => !value); }
      if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); toggleCollapsed(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menuRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); menuTriggerRef.current?.focus(); }
      if (event.key !== 'Tab') return;
      const controls = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', trapFocus); };
  }, [mobileOpen]);

  return <InactivityAutoLogoutGuard timeoutMinutes={30} warningSeconds={60}>
    <div className={`workspace${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-menu-open' : ''}`}>
      <a href="#workspace-main" className="workspace-skip">Langsung ke konten</a>
      {mobileOpen && <button type="button" className="workspace-scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
      <aside id="workspace-navigation" className="workspace-sidebar" ref={menuRef} aria-label="Navigasi utama">
        <div className="workspace-brand"><Link to="/" className="workspace-brand-link" aria-label="Beranda Tarbiyah Sunnah"><BrandEmblem className="h-10 w-10" /><span className="workspace-expanded"><strong>Tarbiyah Sunnah</strong><small>Ruang kerja yayasan</small></span></Link><button className="workspace-icon-button workspace-mobile-only" onClick={() => { setMobileOpen(false); menuTriggerRef.current?.focus(); }} aria-label="Tutup menu"><X /></button></div>
        {canInteract && <div className="workspace-create"><button onClick={() => { setInteractionOpen(true); setMobileOpen(false); }} title="Catat interaksi" className="workspace-create-button"><Plus /><span className="workspace-expanded">Catat interaksi</span></button></div>}
        <nav className="workspace-nav" aria-label="Modul yayasan">{GROUPS.map((group) => {
          const items = destinations.filter((item) => item.group === group);
          if (!items.length) return null;
          return <div key={group} className="workspace-nav-group"><h2 className="workspace-expanded">{group}</h2>{items.map((item) => {
            const Icon = ICONS[item.icon] || LayoutDashboard;
            const active = current?.path === item.path;
            return <Link key={item.path} to={item.path} className={`workspace-nav-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined}><Icon /><span className="workspace-expanded">{item.label}</span>{active && <span className="workspace-active-dot workspace-expanded" />}</Link>;
          })}</div>;
        })}</nav>
        <div className="workspace-public workspace-expanded"><span>Portal jamaah</span><div><Link to="/kajian">Kajian<ExternalLink /></Link><Link to="/peserta">Tiket<ExternalLink /></Link><Link to="/donasi">Donasi<ExternalLink /></Link></div></div>
        <div className="workspace-user"><Link to="/settings" className="workspace-user-link" title={`${user?.name || 'Akun saya'} · ${role}`}><span className="workspace-avatar">{initials}</span><span className="workspace-user-copy workspace-expanded"><strong>{user?.fullName || user?.name || 'Akun saya'}</strong><small>{role}</small></span></Link><button className="workspace-icon-button" onClick={() => logout()} aria-label="Keluar dari akun" title="Keluar"><LogOut /></button></div>
      </aside>
      <div className="workspace-content">
        <header className="workspace-topbar"><div className="workspace-breadcrumb"><button ref={menuTriggerRef} className="workspace-icon-button workspace-mobile-only" onClick={() => setMobileOpen(true)} aria-label="Buka menu" aria-expanded={mobileOpen} aria-controls="workspace-navigation"><Menu /></button><button className="workspace-icon-button workspace-desktop-only" onClick={toggleCollapsed} aria-label={collapsed ? 'Perluas menu' : 'Ringkas menu'} title="Ctrl+B">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button><Link to="/" className="workspace-breadcrumb-root">Ruang kerja</Link><ChevronRight className="workspace-breadcrumb-root" /><span title={current?.label}>{current?.label || 'Halaman'}</span></div><div className="workspace-topbar-actions"><button className="workspace-search" onClick={() => setSearchOpen(true)} aria-label="Cari menu atau jamaah"><Search /><span>Cari menu atau jamaah</span><kbd>Ctrl K</kbd></button><Link to="/settings" className="workspace-account" title={role} aria-label="Buka akun saya"><span className="workspace-avatar">{initials}</span><span>{user?.fullName?.split(' ')[0] || 'Akun'}</span></Link></div></header>
        <main id="workspace-main" className="workspace-main" tabIndex={-1}>{children}</main>
        <footer className="workspace-footer"><span>Yayasan Tarbiyah Sunnah</span><Link to="/ruang-jamaah">Saran & bantuan<ChevronRight /></Link></footer>
      </div>
      {canInteract && interactionOpen && <QuickInteractionModal isOpen onClose={() => setInteractionOpen(false)} onSuccess={interactionSaved} />}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  </InactivityAutoLogoutGuard>;
};
