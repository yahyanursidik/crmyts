/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 · Workbench · DESIGN.md */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { usePermissions } from '@refinedev/core';
import {
  Archive,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  HeartHandshake,
  Landmark,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  PERMISSIONS,
  type PermissionCode,
} from '@server/permissions/constants';
import { canViewReport } from '@server/permissions/navigation';
import { apiClient } from '@/lib/apiClient';
import { useCreateIntent } from '@/lib/useCreateIntent';
import { formatPhoneDisplay } from '@/lib/phone';
import { PersonFormModal } from './components/PersonFormModal';
import { PeopleDialog } from './components/PeopleDialog';
import {
  ENGAGEMENT_LABELS,
  ROLE_LABELS,
  formatDate,
  formatNumber,
  initials,
  personWhatsApp,
  personModuleLink,
} from './model';
import type { PaginationMeta, PersonListItem, PersonOptions } from './types';
import './people.css';

interface Stats {
  totalMaster: number;
  multiKajian: number;
  donorsCount: number;
  waqfCount: number;
  archivedCount?: number;
}
export const PersonsListPage = () => {
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get('search') || '';
  const queryClient = useQueryClient();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const canArchive = permissions.includes(PERMISSIONS.PERSONS_DELETE);
  const canProfile = permissions.some((permission) =>
    [PERMISSIONS.PERSONS_VIEW, PERMISSIONS.PERSONS_VIEW_OPERATIONAL].includes(
      permission as any,
    ),
  );
  const [search, setSearch] = useState(urlSearch);
  const createIntent = useCreateIntent(PERMISSIONS.PERSONS_CREATE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archiveIds, setArchiveIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const value = (key: string, fallback = '') => params.get(key) || fallback;
  const status = value('status', 'active');
  const page = Math.max(1, Number(value('page', '1')) || 1);
  const size = Number(value('size', '15')) || 15;
  const update = (values: Record<string, string>, resetPage = true) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        const commitSearch =
          !('search' in values) &&
          search.trim() !== (previous.get('search') || '');
        if (commitSearch)
          search.trim()
            ? next.set('search', search.trim())
            : next.delete('search');
        for (const [key, input] of Object.entries(values))
          input ? next.set(key, input) : next.delete(key);
        if (resetPage || commitSearch) next.delete('page');
        return next;
      },
      { replace: true },
    );
  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);
  useEffect(() => {
    if (search === (params.get('search') || '')) return;
    const timer = setTimeout(() => update({ search: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, params]);
  const apiParams = new URLSearchParams({
    page: String(page),
    pageSize: String(size),
    status,
    refreshStats: '1',
  });
  for (const [urlKey, apiKey] of Object.entries({
    search: 'search',
    engagement: 'engagementStatus',
    city: 'domisili',
    role: 'roleCode',
    attendance: 'attendanceFilter',
    owner: 'ownerUserId',
    tag: 'tagId',
  }))
    if (value(urlKey)) apiParams.set(apiKey, value(urlKey));
  if (value('sort') === 'name') {
    apiParams.set('sortBy', 'fullName');
    apiParams.set('sortOrder', 'asc');
  }
  if (value('sort') === 'oldest') apiParams.set('sortOrder', 'asc');
  const queryString = apiParams.toString();
  const list = useQuery({
    queryKey: ['persons', 'directory', queryString],
    queryFn: ({ signal }) =>
      apiClient<PersonListItem[]>(`/persons?${queryString}`, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 15000,
  });
  const options = useQuery({
    queryKey: ['persons', 'options'],
    queryFn: () => apiClient<PersonOptions>('/persons/options'),
    staleTime: 60000,
  });
  const rows = list.data?.data || [];
  const pagination = list.data?.meta?.pagination as PaginationMeta | undefined;
  const stats = list.data?.meta?.stats as Stats | undefined;
  const total = pagination?.totalCount || 0;
  const pages = pagination?.totalPages || 1;
  useEffect(() => {
    setSelected(new Set());
  }, [queryString, list.data]);
  const reset = () =>
    setParams(status === 'archived' ? { status: 'archived' } : {}, {
      replace: true,
    });
  const hasFilters = [
    'search',
    'engagement',
    'city',
    'role',
    'attendance',
    'owner',
    'tag',
  ].some((key) => Boolean(value(key)));
  const closeCreate = () => {
    createIntent.clear();
  };
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['persons', 'directory'] });
  const archive = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await apiClient('/persons/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          personIds: archiveIds,
          confirmation: 'ARSIPKAN',
        }),
      });
      setNotice({
        text: `${archiveIds.length} jamaah diarsipkan. Riwayat tetap tersimpan.`,
      });
      setArchiveIds([]);
      setSelected(new Set());
      update({ page: '' });
      await refresh();
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };
  const restore = async (person: PersonListItem) => {
    setBusy(true);
    setNotice(null);
    try {
      await apiClient(`/persons/${person.id}/restore`, { method: 'POST' });
      setNotice({ text: `${person.fullName} dipulihkan.` });
      await refresh();
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  const profile = (person: PersonListItem) =>
    `/people/${person.id}?${new URLSearchParams({ back: `/people?${params.toString()}` })}`;
  const kpis = [
    {
      label: 'Jamaah aktif',
      count: stats?.totalMaster,
      icon: Users,
      tone: 'forest',
      filter: {},
    },
    {
      label: 'Hadir ≥ 2 kegiatan',
      count: stats?.multiKajian,
      icon: CalendarDays,
      tone: 'blue',
      filter: { attendance: 'multi' },
    },
    {
      label: 'Donatur',
      count: stats?.donorsCount,
      icon: HeartHandshake,
      tone: 'gold',
      filter: { role: 'donatur' },
    },
    {
      label: 'Wakif & relawan',
      count: stats?.waqfCount,
      icon: Landmark,
      tone: 'warm',
      filter: { role: 'wakif_relawan' },
    },
  ];
  const personName = (person: PersonListItem) => (
    <div className="people-person">
      <span className="people-avatar">{initials(person.fullName)}</span>
      <div>
        {canProfile ? (
          <Link to={profile(person)} className="people-name">
            {person.fullName}
          </Link>
        ) : (
          <strong className="people-name">{person.fullName}</strong>
        )}
        <span className={`people-status ${person.engagementStatus}`}>
          {ENGAGEMENT_LABELS[person.engagementStatus] ||
            person.engagementStatus}
        </span>
        <div className="people-tags">
          {person.roles.map((role) => (
            <span key={role} className="people-tag">
              {ROLE_LABELS[role] || role}
            </span>
          ))}
          {person.tags.map((tag) => (
            <span key={tag.id} className="people-tag">
              {tag.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
  const contact = (person: PersonListItem) => {
    const link = personWhatsApp(
      person.phoneE164,
      `Assalamu’alaikum, ${person.fullName}`,
    );
    return (
      <>
        <div className="people-contact">
          <span>{formatPhoneDisplay(person.phoneE164)}</span>
          {link && (
            <a
              className="people-inline-link"
              href={link}
              target="_blank"
              rel="noreferrer"
              aria-label={`WhatsApp ${person.fullName}`}
            >
              <MessageSquare />
            </a>
          )}
        </div>
        {person.email && (
          <span className="people-secondary">{person.email}</span>
        )}
      </>
    );
  };
  const actions = (person: PersonListItem) => (
    <div className="people-row-actions">
      {canProfile && (
        <Link
          to={profile(person)}
          className="people-icon-button"
          aria-label={`Buka profil ${person.fullName}`}
        >
          <ArrowRight />
        </Link>
      )}
      {canArchive &&
        (status === 'archived' ? (
          <button
            className="people-icon-button"
            disabled={busy}
            onClick={() => void restore(person)}
            aria-label={`Pulihkan ${person.fullName}`}
          >
            <RotateCcw />
          </button>
        ) : (
          <button
            className="people-icon-button"
            disabled={busy}
            onClick={() => setArchiveIds([person.id])}
            aria-label={`Arsipkan ${person.fullName}`}
          >
            <Archive />
          </button>
        ))}
    </div>
  );
  const filter = (
    key: string,
    label: string,
    choices: Array<[string, string]>,
  ) => (
    <div className="people-field">
      <label htmlFor={`people-${key}`}>{label}</label>
      <select
        className="people-input"
        id={`people-${key}`}
        value={value(key)}
        onChange={(event) => update({ [key]: event.target.value })}
      >
        {choices.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
  const selectRow = (person: PersonListItem) =>
    canArchive && status !== 'archived' ? (
      <input
        type="checkbox"
        checked={selected.has(person.id)}
        onChange={() => toggle(person.id)}
        aria-label={`Pilih ${person.fullName}`}
      />
    ) : null;
  return (
    <div className="people-workspace">
      <header className="people-heading">
        <div>
          <p className="people-eyebrow">Jamaah · kegiatan · layanan</p>
          <h1>Jamaah</h1>
        </div>
        <div className="people-heading-actions">
          {canViewReport('import_export', permissions) && (
            <Link className="people-button" to="/reports?tab=import_export">
              Impor CSV
            </Link>
          )}
          {permissions.includes(PERMISSIONS.DATA_QUALITY_MANAGE) && (
            <Link to="/data-quality" className="people-button">
              <ShieldCheck />
              Kualitas data
            </Link>
          )}
          {permissions.includes(PERMISSIONS.PERSONS_CREATE) && (
            <button
              className="people-button is-primary"
              onClick={() => update({ action: 'create' }, false)}
            >
              <Plus />
              Tambah jamaah
            </button>
          )}
        </div>
      </header>
      {notice && (
        <div
          className={`people-notice ${notice.error ? 'is-error' : 'is-success'}`}
          role="status"
        >
          <span>{notice.text}</span>
          <button
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice(null)}
          >
            <X />
          </button>
        </div>
      )}
      <div className="people-kpis">
        {kpis.map(
          ({ label, count, icon: Icon, tone, filter: selectedFilter }) => (
            <button
              key={label}
              className={`people-kpi people-tone-${tone}`}
              onClick={() => {
                setSearch('');
                setParams(
                  Object.fromEntries(
                    Object.entries(selectedFilter).filter(
                      (entry): entry is [string, string] =>
                        typeof entry[1] === 'string',
                    ),
                  ),
                  { replace: true },
                );
              }}
              aria-label={`${label}: ${count === undefined ? 'belum dimuat' : formatNumber(count)}`}
            >
              <span>
                {label}
                <Icon />
              </span>
              <strong>{count === undefined ? '—' : formatNumber(count)}</strong>
            </button>
          ),
        )}
      </div>
      <section
        className="people-panel people-toolbar"
        aria-label="Cari dan filter jamaah"
      >
        <div className="people-toolbar-top">
          <div className="people-view-switch">
            <button
              aria-pressed={status !== 'archived'}
              onClick={() => update({ status: '' })}
            >
              Aktif
            </button>
            <button
              aria-pressed={status === 'archived'}
              onClick={() => update({ status: 'archived' })}
            >
              Arsip
              {stats?.archivedCount !== undefined && (
                <span>{formatNumber(stats.archivedCount)}</span>
              )}
            </button>
          </div>
          <button
            className="people-icon-button"
            disabled={list.isFetching}
            onClick={() => void refresh()}
            aria-label="Segarkan jamaah"
          >
            <RefreshCw className={list.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="people-search-row">
          <div className="people-search">
            <Search />
            <input
              className="people-input"
              aria-label="Cari jamaah"
              placeholder="Nama, WhatsApp, atau email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Bersihkan pencarian"
              >
                <X />
              </button>
            )}
          </div>
        </div>
        <div className="people-filters">
          {filter('engagement', 'Keterlibatan', [
            ['', 'Semua status'],
            ...Object.entries(ENGAGEMENT_LABELS),
          ])}
          {filter('role', 'Peran jamaah', [
            ['', 'Semua peran'],
            ...Object.entries(ROLE_LABELS),
            ['wakif_relawan', 'Wakif & relawan'],
          ])}
          {filter('attendance', 'Kehadiran', [
            ['', 'Semua kehadiran'],
            ['multi', 'Hadir ≥ 2 kegiatan'],
            ['single', 'Hadir 1 kegiatan'],
            ['none', 'Belum pernah hadir'],
          ])}
          {filter('sort', 'Urutan', [
            ['', 'Terbaru'],
            ['name', 'Nama A–Z'],
            ['oldest', 'Terlama'],
          ])}
        </div>
        <details className="people-more-filters">
          <summary>
            <Filter className="inline" /> Filter lainnya
          </summary>
          <div>
            <div className="people-field">
              <label htmlFor="people-city">Domisili</label>
              <input
                id="people-city"
                className="people-input"
                value={value('city')}
                onChange={(event) => update({ city: event.target.value })}
                placeholder="Kota atau provinsi"
              />
            </div>
            {filter('owner', 'PIC', [
              ['', 'Semua PIC'],
              ['unassigned', 'Belum ada PIC'],
              ...(options.data?.data.staff || []).map(
                (staff) => [staff.id, staff.fullName] as [string, string],
              ),
            ])}
            {filter('tag', 'Tag', [
              ['', 'Semua tag'],
              ...(options.data?.data.tags || []).map(
                (tag) => [tag.id, tag.name] as [string, string],
              ),
            ])}
          </div>
        </details>
        {options.isError && (
          <p className="people-form-hint">
            Pilihan PIC/tag belum dapat dimuat.{' '}
            <button
              className="people-inline-link"
              onClick={() => void options.refetch()}
            >
              Coba lagi
            </button>
          </p>
        )}
      </section>
      <div className="people-result-row">
        <span role="status">
          {list.isFetching
            ? 'Memuat jamaah…'
            : `${formatNumber(total)} jamaah${status === 'archived' ? ' dalam arsip' : ' ditemukan'}`}
        </span>
        {hasFilters && (
          <button className="people-inline-link" onClick={reset}>
            Reset filter
            <X />
          </button>
        )}
      </div>
      {selected.size > 0 && (
        <div className="people-selection-bar">
          <span>{selected.size} jamaah dipilih</span>
          <div className="people-heading-actions">
            <button
              className="people-inline-link"
              onClick={() => setSelected(new Set())}
            >
              Batal pilih
            </button>
            <button
              className="people-button is-small is-warning"
              onClick={() => setArchiveIds([...selected])}
            >
              <Archive />
              Arsipkan pilihan
            </button>
          </div>
        </div>
      )}
      {list.isError && (
        <div className="people-notice is-error" role="alert">
          <span>{(list.error as Error).message}</span>
          <button
            className="people-inline-link"
            onClick={() => void list.refetch()}
          >
            Coba lagi
          </button>
        </div>
      )}
      {list.isPending || list.isPlaceholderData ? (
        <div className="people-panel people-empty" role="status">
          <Loader2 className="animate-spin" />
          Memuat daftar jamaah…
        </div>
      ) : !rows.length ? (
        <div className="people-panel people-empty">
          <Users />
          <p>
            {hasFilters
              ? 'Tidak ada jamaah yang cocok.'
              : status === 'archived'
                ? 'Belum ada jamaah dalam arsip.'
                : 'Belum ada jamaah.'}
          </p>
          {hasFilters ? (
            <button className="people-button" onClick={reset}>
              Reset filter
            </button>
          ) : (
            status !== 'archived' &&
            permissions.includes(PERMISSIONS.PERSONS_CREATE) && (
              <button
                className="people-button"
                onClick={() => update({ action: 'create' }, false)}
              >
                <Plus />
                Tambah jamaah
              </button>
            )
          )}
        </div>
      ) : (
        <>
          <div className="people-panel people-table-scroll">
            <table className="people-table">
              <thead>
                <tr>
                  <th>
                    {canArchive && status !== 'archived' && (
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Pilih semua jamaah pada halaman ini"
                      />
                    )}
                  </th>
                  <th>Jamaah</th>
                  <th>Kontak</th>
                  <th>Domisili</th>
                  <th>Kehadiran</th>
                  <th>PIC</th>
                  <th>Tindak lanjut</th>
                  <th>
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((person) => (
                  <tr key={person.id}>
                    <td>{selectRow(person)}</td>
                    <td>{personName(person)}</td>
                    <td>{contact(person)}</td>
                    <td>
                      {person.cityRegency || '—'}
                      <span className="people-secondary">
                        {person.province}
                      </span>
                    </td>
                    <td>
                      <strong>{person.attendanceCount || 0} kegiatan</strong>
                      <span className="people-secondary">
                        {person.lastAttendance
                          ? `${person.lastAttendance.eventTitle} · ${formatDate(person.lastAttendance.startAt)}`
                          : 'Belum pernah hadir'}
                      </span>
                    </td>
                    <td>{person.owner?.fullName || 'Belum ada PIC'}</td>
                    <td>
                      {person.nextTask ? (
                        <Link
                          className="people-inline-link"
                          to={personModuleLink('/tasks', person.id)}
                        >
                          <CheckSquare />
                          {formatDate(person.nextTask.dueAt)}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {person.nextTask?.isOverdue && (
                        <span className="people-secondary">Terlambat</span>
                      )}
                    </td>
                    <td>{actions(person)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="people-cards">
            {canArchive && status !== 'archived' && (
              <label className="people-inline-link">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                Pilih semua di halaman ini
              </label>
            )}
            {rows.map((person) => (
              <article key={person.id} className="people-panel people-card">
                <div className="people-card-heading">
                  {personName(person)}
                  {selectRow(person)}
                </div>
                <div className="mt-3 text-xs">{contact(person)}</div>
                <dl>
                  <div>
                    <dt>Domisili</dt>
                    <dd>{person.cityRegency || 'Belum diisi'}</dd>
                  </div>
                  <div>
                    <dt>PIC</dt>
                    <dd>{person.owner?.fullName || 'Belum ada PIC'}</dd>
                  </div>
                  <div>
                    <dt>Kehadiran</dt>
                    <dd>{person.attendanceCount || 0} kegiatan</dd>
                  </div>
                  <div>
                    <dt>Tindak lanjut</dt>
                    <dd>
                      {person.nextTask
                        ? formatDate(person.nextTask.dueAt)
                        : 'Tidak ada tugas'}
                    </dd>
                  </div>
                </dl>
                <div className="people-card-footer">
                  <span className="people-form-hint">
                    Terdaftar {formatDate(person.createdAt)}
                  </span>
                  {actions(person)}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <footer className="people-pagination">
        <div>
          <label htmlFor="people-size">Per halaman</label>
          <select
            id="people-size"
            value={size}
            onChange={(event) => update({ size: event.target.value })}
          >
            {[15, 30, 50, 100].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div>
          <button
            className="people-button is-small"
            disabled={page <= 1 || list.isFetching}
            onClick={() => update({ page: String(page - 1) }, false)}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft />
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            className="people-button is-small"
            disabled={page >= pages || list.isFetching}
            onClick={() => update({ page: String(page + 1) }, false)}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight />
          </button>
        </div>
      </footer>
      <PersonFormModal
        isOpen={createIntent.active}
        onClose={closeCreate}
        onSuccess={() => {
          setNotice({ text: 'Jamaah berhasil disimpan.' });
          void refresh();
        }}
      />
      <PeopleDialog
        open={archiveIds.length > 0}
        title={`Arsipkan ${archiveIds.length} jamaah?`}
        busy={busy}
        onClose={() => setArchiveIds([])}
      >
        <div className="people-form-body">
          <p className="text-sm">
            Riwayat event, interaksi, tugas, donasi, dan wakaf tetap tersimpan.
            Jamaah dapat dipulihkan dari Arsip.
          </p>
        </div>
        <div className="people-form-footer">
          <button
            className="people-button"
            disabled={busy}
            onClick={() => setArchiveIds([])}
          >
            Batal
          </button>
          <button
            className="people-button is-primary"
            disabled={busy}
            onClick={() => void archive()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Archive />}Arsipkan
          </button>
        </div>
      </PeopleDialog>
    </div>
  );
};
