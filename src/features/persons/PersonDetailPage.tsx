/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 · Workbench · DESIGN.md */
import { useLayoutEffect, useState } from 'react';
import {
  Link,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
} from 'react-router';
import { useGetIdentity, usePermissions } from '@refinedev/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Award,
  CalendarDays,
  Check,
  CheckSquare,
  Edit3,
  HeartHandshake,
  History,
  Landmark,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  PERMISSIONS,
  type PermissionCode,
} from '@server/permissions/constants';
import { apiClient } from '@/lib/apiClient';
import type { UserIdentity } from '@/lib/authProvider';
import { formatPhoneDisplay } from '@/lib/phone';
import { eventPanelLink } from '@/features/dashboard/model';
import { ECertificateModal } from '@/features/events/ECertificateModal';
import { PersonFormModal } from './components/PersonFormModal';
import { AddInteractionModal } from './components/AddInteractionModal';
import { SensitiveNoteModal } from './components/SensitiveNoteModal';
import { PeopleDialog } from './components/PeopleDialog';
import {
  CHANNEL_LABELS,
  ENGAGEMENT_LABELS,
  OPEN_TASK_STATUSES,
  ROLE_LABELS,
  STATUS_LABELS,
  WAQF_LABELS,
  formatDate,
  formatMoney,
  formatNumber,
  initials,
  peopleBackPath,
  personModuleLink,
  personWhatsApp,
} from './model';
import type { PersonDetailData } from './types';
import './people.css';

export const PersonDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType === 'PUSH')
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id, navigationType]);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const { data: identity } = useGetIdentity<UserIdentity>();
  const can = (permission: PermissionCode) => permissions.includes(permission);
  const profile = useQuery({
    queryKey: ['persons', 'profile', id],
    queryFn: ({ signal }) =>
      apiClient<PersonDetailData>(`/persons/${id}`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
  const data = profile.data?.data;
  const back = peopleBackPath(params.get('back'));
  const [edit, setEdit] = useState(false);
  const [interaction, setInteraction] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [noteToArchive, setNoteToArchive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [taskBusy, setTaskBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [certificate, setCertificate] = useState<{
    eventTitle: string;
    speaker: string;
    dateStr: string;
    ticketCode: string;
  } | null>(null);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['persons'] });
  };
  const tabs = [
    { key: 'timeline', label: 'Linimasa', allowed: true },
    { key: 'events', label: 'Kehadiran', allowed: true },
    {
      key: 'interactions',
      label: 'Interaksi',
      allowed: can(PERMISSIONS.INTERACTIONS_VIEW),
    },
    {
      key: 'tasks',
      label: 'Tugas',
      allowed:
        can(PERMISSIONS.TASKS_VIEW_OWN) || can(PERMISSIONS.TASKS_VIEW_ALL),
    },
    {
      key: 'donations',
      label: 'Donasi',
      allowed:
        can(PERMISSIONS.DONATIONS_VIEW_DETAIL) ||
        can(PERMISSIONS.DONATIONS_VIEW_UNVERIFIED),
    },
    { key: 'waqf', label: 'Wakaf', allowed: can(PERMISSIONS.WAQF_VIEW_DETAIL) },
    {
      key: 'sensitive',
      label: 'Catatan khusus',
      allowed:
        can(PERMISSIONS.SENSITIVE_NOTES_VIEW) ||
        can(PERMISSIONS.SENSITIVE_NOTES_CREATE),
    },
  ].filter((tab) => tab.allowed);
  const activeTab = tabs.some((tab) => tab.key === params.get('tab'))
    ? params.get('tab')!
    : 'timeline';
  const setTab = (tab: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  const archive = async () => {
    setBusy(true);
    try {
      await apiClient(`/persons/${id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['persons'] });
      navigate(back);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    setBusy(true);
    try {
      await apiClient(`/persons/${id}/restore`, { method: 'POST' });
      await refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const archiveNote = async () => {
    if (!noteToArchive) return;
    setBusy(true);
    try {
      await apiClient(
        `/persons/${id}/sensitive-notes/${noteToArchive}/archive`,
        { method: 'POST' },
      );
      setNoteToArchive(null);
      await refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggleTask = async (taskId: string, status: string) => {
    setTaskBusy(taskId);
    try {
      await apiClient(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: status === 'completed' ? 'pending' : 'completed',
        }),
      });
      await refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setTaskBusy('');
    }
  };
  const badge = (status: string, label?: string) => (
    <span className={`people-status ${status}`}>
      {label || STATUS_LABELS[status] || status}
    </span>
  );
  const empty = (text: string) => (
    <div className="people-empty">
      <History />
      <p>{text}</p>
    </div>
  );
  if (profile.isPending)
    return (
      <div className="people-panel people-empty" role="status">
        <Loader2 className="animate-spin" />
        Memuat profil jamaah…
      </div>
    );
  if (!data)
    return (
      <div className="people-workspace">
        <div className="people-notice is-error" role="alert">
          {profile.error?.message || 'Jamaah tidak ditemukan.'}
          <button
            className="people-inline-link"
            onClick={() => void profile.refetch()}
          >
            Coba lagi
          </button>
        </div>
        <Link className="people-button" to={back}>
          <ArrowLeft />
          Kembali ke jamaah
        </Link>
      </div>
    );
  const whatsapp = personWhatsApp(
    data.phoneE164,
    `Assalamu’alaikum, ${data.fullName}`,
  );
  const metricCards = [
    {
      label: 'Hadir kegiatan',
      value: formatNumber(data.metrics.totalAttendances),
      tab: 'events',
      tone: 'blue',
    },
    {
      label: 'Interaksi',
      value: formatNumber(data.metrics.totalInteractions),
      tab: 'interactions',
      tone: 'forest',
    },
    {
      label: 'Tugas terbuka',
      value: formatNumber(data.metrics.pendingTasksCount),
      tab: 'tasks',
      tone: 'warm',
    },
    {
      label: 'Donasi sah',
      value: formatMoney(data.metrics.verifiedTotalDonationsRupiah),
      tab: 'donations',
      tone: 'gold',
    },
    {
      label: 'Wakaf aktif',
      value: formatNumber(data.metrics.activeWaqfCasesCount),
      tab: 'waqf',
      tone: 'forest',
    },
  ].filter((item) => tabs.some((tab) => tab.key === item.tab));
  const sectionHeading = (title: string, action?: React.ReactNode) => (
    <div className="person-section-heading">
      <h2>{title}</h2>
      {action}
    </div>
  );
  const moduleLink = (
    path: '/tasks' | '/donations' | '/waqf' | '/interactions',
    label: string,
  ) => (
    <Link className="people-inline-link" to={personModuleLink(path, id)}>
      {label}
      <ArrowRight />
    </Link>
  );
  const icons: Record<string, typeof History> = {
    attendance: CalendarDays,
    interaction: MessageSquare,
    task: CheckSquare,
    donation: HeartHandshake,
    waqf: Landmark,
    sensitive_note: ShieldCheck,
  };
  return (
    <div className="person-profile">
      <Link to={back} className="people-inline-link mb-4">
        <ArrowLeft />
        Kembali ke jamaah
      </Link>
      <header className="people-heading">
        <div className="person-heading-name">
          <span className="people-avatar">{initials(data.fullName)}</span>
          <div>
            <h1>{data.fullName}</h1>
            <div className="people-tags">
              {badge(
                data.engagementStatus,
                ENGAGEMENT_LABELS[data.engagementStatus],
              )}
              {data.isActive === false && badge('waiting', 'Dalam arsip')}
              {data.roles.map((role) => (
                <span key={role} className="people-tag">
                  {ROLE_LABELS[role] || role}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="people-heading-actions">
          <button
            className="people-icon-button"
            disabled={profile.isFetching}
            onClick={() => void profile.refetch()}
            aria-label="Segarkan profil"
          >
            <RefreshCw className={profile.isFetching ? 'animate-spin' : ''} />
          </button>
          {data.isActive !== false && can(PERMISSIONS.INTERACTIONS_CREATE) && (
            <button
              className="people-button is-primary"
              onClick={() => setInteraction(true)}
            >
              <MessageSquare />
              Catat interaksi
            </button>
          )}
          {data.isActive !== false && can(PERMISSIONS.PERSONS_EDIT) && (
            <button className="people-button" onClick={() => setEdit(true)}>
              <Edit3 />
              Edit profil
            </button>
          )}
          {can(PERMISSIONS.PERSONS_DELETE) &&
            (data.isActive === false ? (
              <button
                className="people-button"
                disabled={busy}
                onClick={() => void restore()}
              >
                <RotateCcw />
                Pulihkan
              </button>
            ) : (
              <button
                className="people-icon-button"
                onClick={() => setArchiveOpen(true)}
                aria-label="Arsipkan jamaah"
              >
                <Archive />
              </button>
            ))}
        </div>
      </header>
      {notice && (
        <div className="people-notice is-error" role="alert">
          {notice}
          <button className="people-inline-link" onClick={() => setNotice('')}>
            Tutup
          </button>
        </div>
      )}
      {profile.isError && (
        <div className="people-notice" role="alert">
          Pembaruan profil gagal. Data terakhir tetap ditampilkan.
        </div>
      )}
      {data.isActive === false && (
        <div className="people-notice">
          Jamaah berada dalam arsip. Riwayat kegiatan dan layanan tetap
          tersimpan.
        </div>
      )}
      <div className="people-kpis">
        {metricCards.map((item) => (
          <button
            key={item.tab}
            className={`people-kpi people-tone-${item.tone}`}
            onClick={() => setTab(item.tab)}
          >
            <span>
              {item.label}
              <ArrowRight />
            </span>
            <strong
              className={item.tab === 'donations' ? 'person-record-amount' : ''}
            >
              {item.value}
            </strong>
          </button>
        ))}
      </div>
      <div className="person-layout">
        <aside className="people-panel person-contact-panel">
          <h2>Kontak & profil</h2>
          <dl>
            <div>
              <dt>WhatsApp</dt>
              <dd>
                <span>{formatPhoneDisplay(data.phoneE164)}</span>
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <span>{data.email || 'Belum diisi'}</span>
              </dd>
            </div>
            <div>
              <dt>Domisili</dt>
              <dd>
                <span>
                  {[data.cityRegency, data.province]
                    .filter(Boolean)
                    .join(', ') || 'Belum diisi'}
                </span>
              </dd>
            </div>
            <div>
              <dt>PIC staf</dt>
              <dd>
                <span>{data.owner?.fullName || 'Belum ada PIC'}</span>
              </dd>
            </div>
            <div>
              <dt>Terdaftar</dt>
              <dd>{formatDate(data.createdAt)}</dd>
            </div>
            <div>
              <dt>Tag</dt>
              <dd className="people-tags">
                {data.tags.length
                  ? data.tags.map((tag) => (
                      <span key={tag.id} className="people-tag">
                        {tag.name}
                      </span>
                    ))
                  : 'Belum ada tag'}
              </dd>
            </div>
          </dl>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="people-button"
            >
              <MessageSquare />
              Buka WhatsApp
            </a>
          )}
          {data.email && (
            <a href={`mailto:${data.email}`} className="people-button">
              <Mail />
              Buka email
            </a>
          )}
          <details className="people-form-details">
            <summary>Profil lainnya</summary>
            <dl>
              <div>
                <dt>Jenis kelamin</dt>
                <dd>
                  {data.gender === 'ikhwan'
                    ? 'Ikhwan'
                    : data.gender === 'akhwat'
                      ? 'Akhwat'
                      : 'Belum diisi'}
                </dd>
              </div>
              <div>
                <dt>Kecamatan</dt>
                <dd>{data.district || 'Belum diisi'}</dd>
              </div>
              <div>
                <dt>Pekerjaan</dt>
                <dd>{data.occupation || 'Belum diisi'}</dd>
              </div>
              <div>
                <dt>Pendidikan</dt>
                <dd>{data.educationLevel || 'Belum diisi'}</dd>
              </div>
              <div>
                <dt>Sumber kontak</dt>
                <dd>{data.sourceCode || 'Belum diisi'}</dd>
              </div>
              <div>
                <dt>Kanal pilihan</dt>
                <dd>
                  {CHANNEL_LABELS[data.preferredChannel] ||
                    data.preferredChannel}
                </dd>
              </div>
            </dl>
          </details>
          {data.isActive !== false && (
            <div className="people-form-details">
              <h2>Mulai tindak lanjut</h2>
              {can(PERMISSIONS.TASKS_CREATE) && (
                <Link
                  className="people-button"
                  to={personModuleLink('/tasks', id, true)}
                >
                  <CheckSquare />
                  Buat tugas
                </Link>
              )}
              {can(PERMISSIONS.DONATIONS_CREATE) && (
                <Link
                  className="people-button"
                  to={personModuleLink('/donations', id, true)}
                >
                  <HeartHandshake />
                  Catat donasi
                </Link>
              )}
              {can(PERMISSIONS.WAQF_CREATE) && (
                <Link
                  className="people-button"
                  to={personModuleLink('/waqf', id, true)}
                >
                  <Landmark />
                  Kasus wakaf
                </Link>
              )}
            </div>
          )}
        </aside>
        <div className="person-content">
          <nav className="person-tabs" aria-label="Bagian profil">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                aria-pressed={activeTab === tab.key}
                onClick={() => setTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <select
            className="people-input person-tab-select"
            aria-label="Bagian profil"
            value={activeTab}
            onChange={(event) => setTab(event.target.value)}
          >
            {tabs.map((tab) => (
              <option key={tab.key} value={tab.key}>
                {tab.label}
              </option>
            ))}
          </select>
          <section className="people-panel person-section">
            {activeTab === 'timeline' && (
              <>
                {sectionHeading('Linimasa jamaah')}
                <div className="person-filter-row">
                  {[
                    { key: 'all', label: 'Semua' },
                    ...tabs
                      .filter(
                        (tab) => !['timeline', 'sensitive'].includes(tab.key),
                      )
                      .map((tab) => ({
                        key: (
                          {
                            events: 'attendance',
                            interactions: 'interaction',
                            tasks: 'task',
                            donations: 'donation',
                            waqf: 'waqf',
                          } as Record<string, string>
                        )[tab.key]!,
                        label: tab.label,
                      })),
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      aria-pressed={timelineFilter === filter.key}
                      onClick={() => setTimelineFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                {data.timeline.filter(
                  (item) =>
                    timelineFilter === 'all' || item.type === timelineFilter,
                ).length ? (
                  <div className="person-record-list">
                    {data.timeline
                      .filter(
                        (item) =>
                          timelineFilter === 'all' ||
                          item.type === timelineFilter,
                      )
                      .map((item) => {
                        const Icon = icons[item.type] || History;
                        return (
                          <article key={item.id} className="person-record">
                            <span className="person-record-icon">
                              <Icon />
                            </span>
                            <div>
                              <h3>{item.title}</h3>
                              <p>{item.description}</p>
                              <div className="person-record-meta">
                                <time>{formatDate(item.date, true)}</time>
                                {item.status &&
                                  badge(
                                    item.status,
                                    item.type === 'waqf'
                                      ? WAQF_LABELS[item.status]
                                      : STATUS_LABELS[item.status],
                                  )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                ) : (
                  empty('Belum ada aktivitas pada pilihan ini.')
                )}
              </>
            )}
            {activeTab === 'events' && (
              <>
                {sectionHeading('Pendaftaran & kehadiran')}
                <div className="person-record-list">
                  {data.attendances.map((attendance) => (
                    <article className="person-record" key={attendance.id}>
                      <span className="person-record-icon">
                        <CalendarDays />
                      </span>
                      <div>
                        <h3>{attendance.event.title}</h3>
                        <p>
                          {formatDate(attendance.event.startAt, true)} ·{' '}
                          {attendance.event.speaker}
                        </p>
                        <div className="person-record-meta">
                          {badge(attendance.status)}
                          {attendance.status === 'attended' && (
                            <span>
                              Presensi {formatDate(attendance.checkInAt, true)}
                            </span>
                          )}
                        </div>
                        <div className="person-record-actions">
                          {can(PERMISSIONS.EVENTS_VIEW) && (
                            <Link
                              className="people-inline-link"
                              to={eventPanelLink(attendance.event.id)}
                            >
                              Buka event
                              <ArrowRight />
                            </Link>
                          )}
                          {attendance.status === 'attended' && (
                            <button
                              className="people-inline-link"
                              onClick={() =>
                                setCertificate({
                                  eventTitle: attendance.event.title,
                                  speaker: attendance.event.speaker,
                                  dateStr: attendance.event.startAt,
                                  ticketCode:
                                    attendance.ticketCode || attendance.id,
                                })
                              }
                            >
                              <Award />
                              Sertifikat
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                  {data.routineAttendance?.map((attendance) => (
                    <article
                      key={`r-${attendance.id}`}
                      className="person-record"
                    >
                      <span className="person-record-icon">
                        <CalendarDays />
                      </span>
                      <div>
                        <h3>{attendance.seriesTitle}</h3>
                        <p>
                          {formatDate(attendance.startAt, true)} · Kajian rutin
                        </p>
                        <div className="person-record-meta">
                          {badge(attendance.status)}
                          {attendance.speaker && (
                            <span>{attendance.speaker}</span>
                          )}
                        </div>
                        {can(PERMISSIONS.EVENTS_VIEW) && (
                          <div className="person-record-actions">
                            <Link
                              to={'/kajian-rutin?seriesId=' + attendance.seriesId + '&sessionId=' + attendance.sessionId + '&panel=attendance&sessions=all'}
                              className="people-inline-link"
                            >
                              Kelola kajian rutin
                              <ArrowRight />
                            </Link>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {!data.attendances.length &&
                  !data.routineAttendance?.length &&
                  empty('Belum ada pendaftaran atau kehadiran.')}
              </>
            )}
            {activeTab === 'interactions' && (
              <>
                {sectionHeading(
                  'Interaksi',
                  moduleLink('/interactions', 'Semua interaksi'),
                )}
                {data.interactions.length ? (
                  <div className="person-record-list">
                    {data.interactions.map((item) => (
                      <article key={item.id} className="person-record">
                        <span className="person-record-icon">
                          <MessageSquare />
                        </span>
                        <div>
                          <h3>
                            {CHANNEL_LABELS[item.channel] || item.channel}
                          </h3>
                          <p>{item.summary}</p>
                          <div className="person-record-meta">
                            <time>{formatDate(item.occurredAt, true)}</time>
                            <span>{item.creator?.fullName}</span>
                            {item.sensitivityLevel !== 'standard' &&
                              badge('waiting', 'Terbatas')}
                          </div>
                          {item.outcome && (
                            <p>{item.outcome.replaceAll('_', ' ')}</p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  empty('Belum ada interaksi yang dapat ditampilkan.')
                )}
              </>
            )}
            {activeTab === 'tasks' && (
              <>
                {sectionHeading(
                  'Tugas & tindak lanjut',
                  moduleLink('/tasks', 'Semua tugas'),
                )}
                {data.tasks.length ? (
                  <div className="person-record-list">
                    {data.tasks.map((task) => (
                      <article key={task.id} className="person-record">
                        <span className="person-record-icon">
                          <CheckSquare />
                        </span>
                        <div>
                          <h3>{task.title}</h3>
                          <p>
                            {task.assignee?.fullName || 'Belum ada PIC'} ·{' '}
                            {formatDate(task.dueAt, true)}
                          </p>
                          <div className="person-record-meta">
                            {badge(task.status)}
                            {OPEN_TASK_STATUSES.includes(task.status) &&
                              Date.parse(task.dueAt) < Date.now() &&
                              badge('waiting', 'Terlambat')}
                          </div>
                          {(can(PERMISSIONS.TASKS_UPDATE_OWN) ||
                            can(PERMISSIONS.TASKS_MANAGE_OWN)) &&
                            (can(PERMISSIONS.TASKS_VIEW_ALL) ||
                              task.assignee?.id === identity?.id) &&
                            task.status !== 'cancelled' && (
                              <div className="person-record-actions">
                                <button
                                  className="people-button is-small"
                                  disabled={taskBusy === task.id}
                                  onClick={() =>
                                    void toggleTask(task.id, task.status)
                                  }
                                >
                                  {taskBusy === task.id ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    <Check />
                                  )}
                                  {task.status === 'completed'
                                    ? 'Buka kembali'
                                    : 'Tandai selesai'}
                                </button>
                              </div>
                            )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  empty('Belum ada tugas pada daftar ini.')
                )}
              </>
            )}
            {activeTab === 'donations' && (
              <>
                {sectionHeading(
                  'Riwayat donasi',
                  moduleLink('/donations', 'Semua donasi'),
                )}
                {data.donations.length ? (
                  <div className="person-record-list">
                    {data.donations.map((donation) => (
                      <article key={donation.id} className="person-record">
                        <span className="person-record-icon">
                          <HeartHandshake />
                        </span>
                        <div>
                          <h3 className="person-record-amount">
                            {formatMoney(donation.amountRupiah)}
                          </h3>
                          <p>
                            {donation.program?.name || 'Donasi umum'} ·{' '}
                            {formatDate(donation.donationDate)}
                          </p>
                          <div className="person-record-meta">
                            {badge(donation.verificationStatus)}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  empty('Belum ada donasi yang dapat ditampilkan.')
                )}
              </>
            )}
            {activeTab === 'waqf' && (
              <>
                {sectionHeading(
                  'Kasus wakaf',
                  moduleLink('/waqf', 'Semua kasus'),
                )}
                {data.waqfCases.length ? (
                  <div className="person-record-list">
                    {data.waqfCases.map((item) => (
                      <article key={item.id} className="person-record">
                        <span className="person-record-icon">
                          <Landmark />
                        </span>
                        <div>
                          <h3>Wakaf {item.waqfType.replaceAll('_', ' ')}</h3>
                          <p>{item.notesSummary}</p>
                          <div className="person-record-meta">
                            {badge(
                              item.currentStage,
                              WAQF_LABELS[item.currentStage],
                            )}
                            <span>{formatDate(item.openedAt)}</span>
                          </div>
                          {item.estimatedValueRupiah !== null &&
                            item.estimatedValueRupiah !== undefined && (
                              <p>{formatMoney(item.estimatedValueRupiah)}</p>
                            )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  empty('Belum ada kasus wakaf.')
                )}
              </>
            )}
            {activeTab === 'sensitive' && (
              <>
                {sectionHeading(
                  'Catatan khusus',
                  can(PERMISSIONS.SENSITIVE_NOTES_CREATE) && (
                    <button
                      className="people-button is-small"
                      onClick={() => setNoteOpen(true)}
                    >
                      <Plus />
                      Tambah catatan
                    </button>
                  ),
                )}
                {data.sensitiveNotes.length ? (
                  <div className="person-record-list">
                    {data.sensitiveNotes.map((note) => (
                      <article key={note.id} className="person-record">
                        <span className="person-record-icon">
                          <ShieldCheck />
                        </span>
                        <div>
                          <h3>
                            {note.sensitivityLevel === 'restricted'
                              ? 'Terbatas'
                              : 'Catatan khusus'}
                          </h3>
                          <p>{note.noteText}</p>
                          <p>Alasan: {note.reason}</p>
                          <div className="person-record-meta">
                            <span>{note.creator?.fullName}</span>
                            <time>{formatDate(note.createdAt, true)}</time>
                            {note.expiresAt && (
                              <span>
                                Berlaku sampai {formatDate(note.expiresAt)}
                              </span>
                            )}
                          </div>
                          {can(PERMISSIONS.SENSITIVE_NOTES_DELETE) && (
                            <div className="person-record-actions">
                              <button
                                className="people-inline-link"
                                onClick={() => setNoteToArchive(note.id)}
                              >
                                <Archive />
                                Arsipkan catatan
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  empty('Belum ada catatan yang dapat ditampilkan.')
                )}
              </>
            )}
          </section>
        </div>
      </div>
      <PersonFormModal
        isOpen={edit}
        initialData={data}
        onClose={() => setEdit(false)}
        onSuccess={() => void refresh()}
      />
      <AddInteractionModal
        isOpen={interaction}
        personId={id}
        personName={data.fullName}
        onClose={() => setInteraction(false)}
        onSuccess={() => void refresh()}
      />
      <SensitiveNoteModal
        open={noteOpen}
        personId={id}
        onClose={() => setNoteOpen(false)}
        onSuccess={() => void refresh()}
      />
      <PeopleDialog
        open={archiveOpen}
        title="Arsipkan jamaah?"
        onClose={() => setArchiveOpen(false)}
        busy={busy}
      >
        <div className="people-form-body">
          <p className="text-sm">
            Riwayat {data.fullName} tetap tersimpan. Profil dapat dipulihkan
            dari daftar Arsip.
          </p>
        </div>
        <footer className="people-form-footer">
          <button
            className="people-button"
            disabled={busy}
            onClick={() => setArchiveOpen(false)}
          >
            Batal
          </button>
          <button
            className="people-button is-primary"
            disabled={busy}
            onClick={() => void archive()}
          >
            <Archive />
            Arsipkan
          </button>
        </footer>
      </PeopleDialog>
      <PeopleDialog
        open={Boolean(noteToArchive)}
        title="Arsipkan catatan khusus?"
        onClose={() => setNoteToArchive(null)}
        busy={busy}
      >
        <div className="people-form-body">
          <p className="text-sm">
            Catatan tidak lagi ditampilkan pada profil. Jejak audit tetap
            tersimpan.
          </p>
        </div>
        <footer className="people-form-footer">
          <button
            className="people-button"
            disabled={busy}
            onClick={() => setNoteToArchive(null)}
          >
            Batal
          </button>
          <button
            className="people-button is-primary"
            disabled={busy}
            onClick={() => void archiveNote()}
          >
            Arsipkan
          </button>
        </footer>
      </PeopleDialog>
      {certificate && (
        <ECertificateModal
          isOpen
          onClose={() => setCertificate(null)}
          attendeeName={data.fullName}
          {...certificate}
        />
      )}
    </div>
  );
};
