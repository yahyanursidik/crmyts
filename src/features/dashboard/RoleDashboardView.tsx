import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Link } from 'react-router';
import { useGetIdentity, usePermissions } from '@refinedev/core';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, LayoutGrid, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { UserIdentity } from '@/lib/authProvider';
import { ROLE_LABELS, canOpenPath } from '@server/permissions/navigation';
import { type PermissionCode, type RoleCode, ROLES } from '@server/permissions/constants';

interface WorkItem { id: string; title: string; subtitle?: string; dueTime?: string; href?: string; tag?: string; overdueDays?: number; }
interface RoleData {
  role: RoleCode; roleName: string;
  roleKpis: Array<{ label: string; value: string | number; color: string }>;
  quickActions: Array<{ label: string; href: string; icon: string; description?: string }>;
  todayItems: WorkItem[]; overdueItems: WorkItem[];
  attentionItems: Array<{ id: string; title: string; description: string; level: string; href?: string }>;
}

export const RoleDashboardView: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const [activeRole, setActiveRole] = useState<RoleCode | null>(null);
  const [data, setData] = useState<RoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const isAdmin = identity?.roles.includes(ROLES.CRM_ADMIN);
  const roles = isAdmin ? Object.keys(ROLE_LABELS) as RoleCode[] : identity?.roles || [];
  useEffect(() => { if (identity?.roles.length) setActiveRole(identity.roles.includes(ROLES.CRM_ADMIN) ? ROLES.CRM_ADMIN : identity.roles[0]!); }, [identity]);
  useEffect(() => {
    if (!activeRole) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    apiClient<RoleData>(`/dashboard/role-view?role=${activeRole}`, { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setData(response.data); })
      .catch((err: Error) => { if (!controller.signal.aborted) setError(err.message || 'Ringkasan belum dapat dimuat.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeRole, refresh]);
  const canFollow = (href: string) => canOpenPath(href, permissions) || ['/gate', '/kajian'].includes(href);
  const workList = (title: string, items: WorkItem[], overdue = false) => <section className="min-w-0 rounded-2xl border border-surface-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center gap-2">{overdue ? <Clock3 className="h-4 w-4 text-amber-700" /> : <CalendarDays className="h-4 w-4 text-brand-700" />}<h3 className="text-sm font-bold text-brand-950">{title}</h3><span className="ml-auto rounded-lg bg-cream-200 px-2 py-1 text-xs text-surface-600">{items.length}</span></div>{items.length ? <div className="divide-y divide-surface-100">{items.map((item) => <div key={item.id} className="flex items-start gap-3 py-3"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-brand-950">{item.title}</p>{item.subtitle && <p className="mt-1 text-xs text-surface-500">{item.subtitle}</p>}{item.overdueDays && <p className="mt-1 text-xs text-amber-800">{item.overdueDays} hari lewat jatuh tempo</p>}</div>{item.href && canFollow(item.href) && <Link to={item.href} className="shrink-0 rounded-lg border border-surface-200 p-2 text-brand-700" aria-label={`Buka ${item.title}`}><ArrowRight className="h-4 w-4" /></Link>}</div>)}</div> : <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-surface-500"><CheckCircle2 className="h-6 w-6 text-brand-400" /><p className="text-xs">{overdue ? 'Tidak ada tindak lanjut terlambat pada daftar ini.' : 'Belum ada agenda pada daftar hari ini.'}</p></div>}</section>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-brand-600">{new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p><h1 className="mt-1 text-xl font-bold text-brand-950 sm:text-2xl">Assalamu’alaikum, {identity?.fullName?.split(' ')[0] || 'Pengurus'}</h1><p className="mt-1 text-sm text-surface-500">{activeRole ? ROLE_LABELS[activeRole] : 'Ruang kerja yayasan'}</p></div><button onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="btn-secondary gap-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Segarkan</button></div>
    {roles.length > 1 && <div className="flex items-center gap-3"><label htmlFor="work-role" className="text-xs font-medium text-surface-600">{isAdmin ? 'Pratinjau peran' : 'Peran aktif'}</label><select id="work-role" value={activeRole || ''} onChange={(event) => setActiveRole(event.target.value as RoleCode)} className="min-w-0 max-w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-brand-950">{roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></div>}
    {loading ? <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-surface-500" role="status"><Loader2 className="h-5 w-5 animate-spin" />Memuat ruang kerja…</div> : error ? <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5" role="alert"><p className="text-sm text-amber-900">{error}</p><button className="btn-secondary" onClick={() => setRefresh((value) => value + 1)}>Coba kembali</button></div> : data && <>
      <div className="grid grid-cols-1 gap-3 min-[375px]:grid-cols-2 xl:grid-cols-4">{data.roleKpis.map((kpi, index) => <div key={kpi.label} className={`min-w-0 rounded-2xl border p-4 ${index % 3 === 0 ? 'border-brand-200 bg-brand-50' : index % 3 === 1 ? 'border-gold-200 bg-gold-50' : 'border-amber-200 bg-amber-50'}`}><span className="text-xs font-medium text-surface-600">{kpi.label}</span><strong className="mt-2 block break-words font-display text-xl font-bold text-brand-950 sm:text-2xl">{kpi.value}</strong></div>)}</div>
      <section><h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-950"><LayoutGrid className="h-4 w-4 text-brand-600" />Akses cepat</h2><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.quickActions.filter((action) => canFollow(action.href)).map((action, index) => <Link key={`${action.href}-${index}`} to={action.href} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3.5 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-400 hover:bg-brand-50"><span>{action.label.replace(/^\+ /, '').replace(/\s*\(60s\)/, '')}</span><ArrowRight className="h-4 w-4 shrink-0 text-brand-600" /></Link>)}</div></section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{workList('Agenda hari ini', data.todayItems)}{workList('Perlu ditindaklanjuti', data.overdueItems, true)}</div>
      {data.attentionItems.length > 0 && <section className="rounded-2xl border border-surface-200 bg-white p-4 sm:p-5"><h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-950"><TriangleAlert className="h-4 w-4 text-amber-700" />Perlu perhatian</h2><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{data.attentionItems.map((item) => <div key={item.id} className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-brand-950">{item.title}</p><p className="mt-1 text-xs leading-relaxed text-surface-600">{item.description}</p>{item.href && canFollow(item.href) && <Link to={item.href} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-brand-800">Tinjau<ArrowRight className="h-3.5 w-3.5" /></Link>}</div>)}</div></section>}
    </>}
  </div>;
};
