/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4
 * genre: modern-minimal · macrostructure: Workbench · design-system: DESIGN.md
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CalendarDays, CheckCheck, CheckSquare, Coins, HeartHandshake, History, Landmark, Loader2, MapPin, MessageSquare, Plus, RefreshCw, ShieldCheck, Ticket, Users } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import type { DashboardResponse } from './types';
import { dashboardLinks, eventPanelLink, monthlyDonationsLink, type DashboardOperations } from './model';

const number = (value: number) => new Intl.NumberFormat('id-ID').format(value);
const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const date = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ...options }).format(new Date(value));

export function AdminOverview() {
  const [stats, setStats] = useState<DashboardResponse | null>(null);
  const [operations, setOperations] = useState<DashboardOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.allSettled([
      apiClient<DashboardResponse>('/dashboard/stats', { signal: controller.signal }),
      apiClient<DashboardOperations>('/dashboard/operations', { signal: controller.signal }),
    ]).then(([summary, agenda]) => {
      if (controller.signal.aborted) return;
      const failures: string[] = [];
      if (summary.status === 'fulfilled') {
        setStats(summary.value.data);
        setUpdatedAt(new Date().toISOString());
      } else failures.push('Ringkasan yayasan belum dapat diperbarui.');
      if (agenda.status === 'fulfilled') setOperations(agenda.value.data);
      else failures.push('Agenda event belum dapat diperbarui.');
      setErrors(failures); setLoading(false);
    });
    return () => controller.abort();
  }, [refresh]);

  const kpis = [
    { label: 'Jamaah', value: stats ? number(stats.kpis.totalJamaah) : '—', detail: stats ? `${number(stats.kpis.aktifJamaah + stats.kpis.rutinJamaah)} aktif & rutin` : 'Data jamaah', to: '/people', icon: Users, tone: 'forest' },
    { label: 'Donasi bulan ini', value: stats ? rupiah(stats.kpis.monthDonationsRupiah) : '—', detail: 'Sudah diverifikasi', to: monthlyDonationsLink(), icon: HeartHandshake, tone: 'gold' },
    { label: 'Agenda event', value: operations ? number(operations.upcomingCount) : '—', detail: 'Mendatang & berlangsung', to: '/events?status=upcoming', icon: CalendarDays, tone: 'blue' },
    { label: 'Wakaf aktif', value: stats ? number(stats.kpis.activeWaqfCases) : '—', detail: 'Dalam proses', to: '/waqf', icon: Landmark, tone: 'warm' },
  ];
  const priorities = [
    { label: 'Verifikasi donasi', value: stats?.kpis.unverifiedDonations, to: dashboardLinks.unverifiedDonations, icon: ShieldCheck, tone: 'gold' },
    { label: 'Tugas terlambat', value: stats?.kpis.overdueTasks, to: dashboardLinks.overdueTasks, icon: CheckSquare, tone: 'warm' },
    { label: 'Lengkapi data jamaah', value: stats?.kpis.dataQualityIssues, to: '/data-quality', icon: Users, tone: 'blue' },
  ];
  const quickActions = [
    { label: 'Catat donasi', to: dashboardLinks.newDonation, icon: Coins, tone: 'gold' },
    { label: 'Buat tugas', to: dashboardLinks.newTask, icon: CheckSquare, tone: 'forest' },
    { label: 'Catat interaksi', to: dashboardLinks.newInteraction, icon: MessageSquare, tone: 'blue' },
    { label: 'Kasus wakaf', to: dashboardLinks.newWaqf, icon: Landmark, tone: 'warm' },
  ];
  return <div className="admin-overview" aria-busy={loading}>
    <header className="admin-heading">
      <div><p className="admin-eyebrow">{date(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>Beranda pengelola</h1></div>
      <div className="admin-heading-actions"><Link className="admin-action" to={dashboardLinks.newPerson}><Plus />Jamaah</Link><Link className="admin-action is-primary" to={dashboardLinks.newEvent}><Plus />Event</Link><button type="button" className="admin-icon-button" aria-label="Segarkan dashboard" title="Segarkan dashboard" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw className={loading ? 'animate-spin' : ''} /></button></div>
    </header>
    {errors.length > 0 && <div className="admin-notice" role="alert"><p>{errors.join(' ')} {stats || operations ? 'Data terakhir tetap ditampilkan.' : ''}</p><button disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Coba lagi</button></div>}
    <div className="admin-kpis">{kpis.map(({ label, value, detail, to, icon: Icon, tone }) => <Link key={label} to={to} className={`admin-kpi tone-${tone}`}><div><span>{label}</span><Icon /></div><strong>{value}</strong><small>{detail}<ArrowRight /></small></Link>)}</div>
    <section className="admin-quick-section"><h2>Mulai pekerjaan</h2><div className="admin-quick-actions">{quickActions.map(({ label, to, icon: Icon, tone }) => <Link key={label} to={to}><span className={`admin-tile-icon tone-${tone}`}><Icon /></span><span>{label}</span><Plus /></Link>)}</div></section>
    <div className="admin-board">
      <section className="admin-panel admin-agenda"><div className="admin-section-heading"><h2><CalendarDays />Agenda event</h2><Link to="/events">Semua<ArrowRight /></Link></div>
        {operations ? operations.upcomingEvents.length ? <div className="admin-event-list">{operations.upcomingEvents.map((event) => <article key={event.id} className="admin-event">
          <div className="admin-event-date"><strong>{date(event.startAt, { day: '2-digit' })}</strong><span>{date(event.startAt, { month: 'short' })}</span></div>
          <div className="admin-event-body"><div className="admin-event-title"><h3>{event.title}</h3>{event.status === 'ongoing' && <span className="admin-badge tone-forest">Berlangsung</span>}</div>
            <p className="admin-event-meta">{date(event.startAt, { weekday: 'short', hour: '2-digit', minute: '2-digit' })} WIB{event.speaker ? ` · ${event.speaker}` : ''}</p>
            <p className="admin-event-meta"><MapPin />{event.locationName || (event.deliveryMode === 'online' ? 'Online' : 'Lokasi belum diisi')}</p>
            <div className="admin-event-bottom"><span><Users />{number(event.registered)}{event.quota ? ` / ${number(event.quota)}` : ''} peserta</span><span><CheckCheck />{number(event.attended)} hadir</span></div>
            <div className="admin-event-actions"><Link to={eventPanelLink(event.id)}>Peserta<ArrowRight /></Link><Link to={eventPanelLink(event.id, 'settings')}>Atur event</Link><span className="admin-registration">{event.isRegistrationOpen ? 'Pendaftaran buka' : 'Pendaftaran tutup'}</span></div>
          </div>
        </article>)}</div> : <div className="admin-empty"><CalendarDays /><p>Belum ada event mendatang.</p><Link to={dashboardLinks.newEvent}>Buat event<ArrowRight /></Link></div> : <PanelState loading={loading} label="Agenda belum tersedia." />}
      </section>
      <aside className="admin-panel admin-priorities"><div className="admin-section-heading"><h2><CheckSquare />Perlu ditangani</h2></div><div className="admin-priority-list">{priorities.map(({ label, value, to, icon: Icon, tone }) => <Link key={label} to={to} className="admin-priority"><span className={`admin-tile-icon tone-${tone}`}><Icon /></span><span>{label}</span><strong className={value ? 'has-items' : ''}>{value === undefined ? '—' : number(value)}</strong><ArrowRight /></Link>)}</div>
        <div className="admin-ticket-reviews"><h3><Ticket />Pembayaran tiket</h3>{operations ? operations.paymentReviews.length ? operations.paymentReviews.map((event) => <Link key={event.id} to={eventPanelLink(event.id)}><span>{event.title}</span><strong>{number(event.count)}</strong><ArrowRight /></Link>) : <p>Tidak ada bukti bayar menunggu verifikasi.</p> : <PanelState loading={loading} label="Antrean tiket belum tersedia." />}</div>
      </aside>
    </div>

    <div className="admin-lower-board"><section className="admin-panel"><div className="admin-section-heading"><h2><CheckSquare />Tugas terdekat</h2><Link to="/tasks">Semua<ArrowRight /></Link></div>{stats ? stats.queues.urgentTasks.length ? <div className="admin-task-list">{stats.queues.urgentTasks.slice(0, 4).map((task) => <Link key={task.id} to={`/tasks?${new URLSearchParams({ search: task.title })}`}><div><h3>{task.title}</h3><p>{task.personName || 'Tugas internal'} · {date(task.dueAt, { day: 'numeric', month: 'short' })}</p></div>{task.isOverdue ? <span className="admin-badge tone-warm">Terlambat</span> : <ArrowRight />}</Link>)}</div> : <div className="admin-empty is-compact"><CheckCheck /><p>Belum ada tugas terbuka.</p><Link to={dashboardLinks.newTask}>Buat tugas<ArrowRight /></Link></div> : <PanelState loading={loading} label="Tugas belum tersedia." />}</section>
      <section className="admin-panel"><div className="admin-section-heading"><h2><History />Aktivitas terbaru</h2><Link to="/audit">Log audit<ArrowRight /></Link></div>{stats ? stats.queues.recentAuditLogs?.length ? <ol className="admin-activity">{stats.queues.recentAuditLogs.slice(0, 4).map((item) => <li key={item.id}><span className="admin-activity-dot" /><div><h3>{item.actorName}</h3><p>{activityLabel(item.action)} · {entityLabel(item.entityType)}</p></div><time dateTime={item.createdAt}>{date(item.createdAt, { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol> : <div className="admin-empty is-compact"><History /><p>Belum ada aktivitas tercatat.</p></div> : <PanelState loading={loading} label="Aktivitas belum tersedia." />}</section></div>
    <p className="admin-updated" role="status">{loading ? 'Memperbarui ringkasan…' : updatedAt ? `Ringkasan diperbarui ${date(updatedAt, { hour: '2-digit', minute: '2-digit' })} WIB` : 'Ringkasan belum dimuat'}</p>
  </div>;
}

function PanelState({ loading, label }: { loading: boolean; label: string }) {
  return <div className="admin-empty is-compact">{loading && <Loader2 className="animate-spin" />}<p>{loading ? 'Memuat…' : label}</p></div>;
}
function activityLabel(action: string) {
  if (/login|sign_in/i.test(action)) return 'Masuk ke akun';
  if (/logout|sign_out/i.test(action)) return 'Keluar dari akun';
  if (/create|register/i.test(action)) return 'Menambah data';
  if (/verify|approve/i.test(action)) return 'Memverifikasi data';
  if (/export/i.test(action)) return 'Mengekspor laporan';
  if (/delete|deactivat/i.test(action)) return 'Menonaktifkan data';
  return 'Memperbarui data';
}
function entityLabel(entity: string) {
  return ({ persons: 'Jamaah', person: 'Jamaah', app_users: 'Akun staf', user: 'Akun staf', task: 'Tugas', tasks: 'Tugas', donation: 'Donasi', donations: 'Donasi', events: 'Event', event: 'Event', waqf_case: 'Wakaf', session: 'Akun staf' } as Record<string, string>)[entity] || 'Yayasan';
}
