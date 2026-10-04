import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Layers,
  LayoutGrid,
  LoaderCircle,
  Megaphone,
  Pencil,
  Power,
  QrCode,
  Table2,
  Trash2,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { apiClient, ApiClientError } from '../../lib/apiClient';
import {
  describeJadwal,
  formatWibDate,
  formatWibShortDate,
  TARGET_AUDIENCE_LABELS,
  WEEKDAY_NAMES,
  type KajianRutinSeries,
  type KajianRutinSession,
  type KajianRutinSpeaker,
  type KajianRutinEarlyBird,
} from '../../lib/kajianRutin';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { KajianRutinSeriesModal } from './KajianRutinSeriesModal';
import { KajianRutinSessionEditModal } from './KajianRutinSessionEditModal';
import { KajianRutinAnnouncementsModal } from './KajianRutinAnnouncementsModal';
import { KajianRutinQrModal } from './KajianRutinQrModal';
import { KajianRutinAttendanceModal } from './KajianRutinAttendanceModal';

interface SessionsPayload {
  series: KajianRutinSeries;
  sessions: KajianRutinSession[];
}

const inputClass =
  'min-h-9 w-full rounded-lg border border-[#d5d1c1] bg-white px-3 py-1.5 text-[13px] text-[#1c321d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365e38]';

function weekdayLabel(sessionDate: string): string {
  const weekday = new Date(`${sessionDate}T05:00:00Z`).getUTCDay();
  return WEEKDAY_NAMES[weekday] || '';
}

function statusBadge(session: KajianRutinSession) {
  if (session.status === 'cancelled') {
    return <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">Dibatalkan</span>;
  }
  return <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">Terjadwal</span>;
}

export function KajianRutinPage() {
  const [seriesList, setSeriesList] = useState<KajianRutinSeries[] | null>(null);
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [totalUniqueAttendees, setTotalUniqueAttendees] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('kajian_rutin_view');
    return saved === 'table' ? 'table' : 'card';
  });
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessionsData, setSessionsData] = useState<SessionsPayload | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<KajianRutinSeries | null>(null);
  const [seriesSaving, setSeriesSaving] = useState(false);
  const [seriesError, setSeriesError] = useState('');
  const [speakers, setSpeakers] = useState<KajianRutinSpeaker[]>([]);

  const [editingSession, setEditingSession] = useState<KajianRutinSession | null>(null);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const [earlyBirds, setEarlyBirds] = useState<{ seriesId: string; items: KajianRutinEarlyBird[]; sessionsCount: number; days: number } | null>(null);
  const [earlyBirdsLoading, setEarlyBirdsLoading] = useState(false);

  const [qrSession, setQrSession] = useState<KajianRutinSession | null>(null);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(null);

  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState<KajianRutinSeries | null>(null);
  const [deletingSeries, setDeletingSeries] = useState(false);
  const [confirmToggleSession, setConfirmToggleSession] = useState<KajianRutinSession | null>(null);
  const [togglingSession, setTogglingSession] = useState(false);

  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionTopic, setNewSessionTopic] = useState('');
  const [addingSession, setAddingSession] = useState(false);
  const [genCount, setGenCount] = useState('4');
  const [generating, setGenerating] = useState(false);

  const loadSeries = useCallback(async (silent = false) => {
    if (!silent) setSeriesList(null);
    try {
      const { data, meta } = await apiClient<KajianRutinSeries[]>('/kajian-rutin/series');
      setSeriesList(data);
      setTotalUniqueAttendees(Number(meta?.totalUniqueAttendees ?? 0));
      setListError('');
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : 'Gagal memuat daftar kajian rutin.');
    }
  }, []);

  const switchViewMode = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('kajian_rutin_view', mode);
  };

  const openSeriesFromTable = (seriesId: string) => {
    setViewMode('card');
    localStorage.setItem('kajian_rutin_view', 'card');
    if (expandedId === seriesId) return;
    setExpandedId(seriesId);
    setSessionsData(null);
    setShowAddSession(false);
    void loadSessions(seriesId);
    void loadEarlyBirds(seriesId);
  };

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  const loadSpeakers = useCallback(async () => {
    try {
      const { data } = await apiClient<KajianRutinSpeaker[]>('/kajian-rutin/speakers');
      setSpeakers(data);
    } catch {
      // daftar pemateri kosong boleh dibiarkan — admin bisa menambah dari form
    }
  }, []);

  useEffect(() => {
    void loadSpeakers();
  }, [loadSpeakers]);

  const addSpeaker = useCallback(async (name: string): Promise<KajianRutinSpeaker | null> => {
    try {
      const { data } = await apiClient<KajianRutinSpeaker>('/kajian-rutin/speakers', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      await loadSpeakers();
      return data;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal menambah pemateri.');
      return null;
    }
  }, [loadSpeakers]);

  const saveSessionEdit = async (payload: Record<string, unknown>) => {
    if (!editingSession) return;
    setSessionSaving(true);
    setSessionError('');
    try {
      await apiClient(`/kajian-rutin/sessions/${editingSession.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setEditingSession(null);
      setNotice('Pertemuan berhasil diperbarui.');
      if (expandedId) await loadSessions(expandedId, true);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Gagal memperbarui pertemuan.');
    } finally {
      setSessionSaving(false);
    }
  };

  const loadSessions = useCallback(async (seriesId: string, silent = false) => {
    if (!silent) setSessionsLoading(true);
    try {
      const { data } = await apiClient<SessionsPayload>(`/kajian-rutin/series/${seriesId}/sessions`);
      setSessionsData(data);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal memuat sesi kajian.');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadEarlyBirds = useCallback(async (seriesId: string) => {
    setEarlyBirdsLoading(true);
    try {
      const { data } = await apiClient<{ items: KajianRutinEarlyBird[]; sessionsCount: number; days: number }>(
        `/kajian-rutin/series/${seriesId}/early-birds?days=30`
      );
      setEarlyBirds({ seriesId, ...data });
    } catch {
      setEarlyBirds(null);
    } finally {
      setEarlyBirdsLoading(false);
    }
  }, []);

  const toggleExpand = (seriesId: string) => {
    if (expandedId === seriesId) {
      setExpandedId(null);
      setSessionsData(null);
      setShowAddSession(false);
      return;
    }
    setExpandedId(seriesId);
    setSessionsData(null);
    setShowAddSession(false);
    void loadSessions(seriesId);
    void loadEarlyBirds(seriesId);
  };

  const saveSeries = async (payload: Record<string, unknown>) => {
    setSeriesSaving(true);
    setSeriesError('');
    try {
      if (editingSeries) {
        await apiClient(`/kajian-rutin/series/${editingSeries.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setNotice('Kajian rutin berhasil diperbarui.');
      } else {
        await apiClient('/kajian-rutin/series', { method: 'POST', body: JSON.stringify(payload) });
        setNotice('Kajian rutin baru berhasil dibuat. Buka panelnya untuk membuat sesi & QR absensi.');
      }
      setSeriesModalOpen(false);
      setEditingSeries(null);
      await loadSeries(true);
      if (expandedId) await loadSessions(expandedId, true);
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : 'Gagal menyimpan kajian rutin.');
    } finally {
      setSeriesSaving(false);
    }
  };

  const toggleSeriesActive = async (series: KajianRutinSeries) => {
    try {
      await apiClient(`/kajian-rutin/series/${series.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !series.isActive }),
      });
      await loadSeries(true);
      setNotice(series.isActive ? `“${series.title}” dinonaktifkan dari portal jamaah.` : `“${series.title}” kembali aktif.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal mengubah status kajian.');
    }
  };

  const deleteSeries = async () => {
    if (!confirmDeleteSeries) return;
    setDeletingSeries(true);
    try {
      await apiClient(`/kajian-rutin/series/${confirmDeleteSeries.id}`, { method: 'DELETE' });
      if (expandedId === confirmDeleteSeries.id) {
        setExpandedId(null);
        setSessionsData(null);
      }
      setConfirmDeleteSeries(null);
      setNotice('Kajian rutin beserta seluruh sesi & absensinya telah dihapus.');
      await loadSeries(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal menghapus kajian rutin.');
      setConfirmDeleteSeries(null);
    } finally {
      setDeletingSeries(false);
    }
  };

  const addSession = async () => {
    if (!sessionsData) return;
    setAddingSession(true);
    setNotice('');
    try {
      await apiClient(`/kajian-rutin/series/${sessionsData.series.id}/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          ...(newSessionDate ? { sessionDate: newSessionDate } : {}),
          ...(newSessionTopic.trim() ? { topic: newSessionTopic.trim() } : {}),
        }),
      });
      setNewSessionDate('');
      setNewSessionTopic('');
      setShowAddSession(false);
      setNotice('Sesi baru dibuat. Klik tombol QR untuk mencetak QR absensinya.');
      await loadSessions(sessionsData.series.id, true);
      await loadSeries(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal membuat sesi.');
    } finally {
      setAddingSession(false);
    }
  };

  const generateSessions = async () => {
    if (!sessionsData) return;
    setGenerating(true);
    setNotice('');
    try {
      const { data } = await apiClient<{ generated: KajianRutinSession[]; plannedDates: string[] }>(
        `/kajian-rutin/series/${sessionsData.series.id}/sessions/generate`,
        { method: 'POST', body: JSON.stringify({ count: Number(genCount) || 4 }) }
      );
      setNotice(`${data.generated.length} sesi berikutnya berhasil dibuat (QR otomatis tersedia per sesi).`);
      await loadSessions(sessionsData.series.id, true);
      await loadSeries(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal generate sesi otomatis.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleSessionStatus = async () => {
    if (!confirmToggleSession || !sessionsData) return;
    setTogglingSession(true);
    try {
      const next = confirmToggleSession.status === 'cancelled' ? 'scheduled' : 'cancelled';
      await apiClient(`/kajian-rutin/sessions/${confirmToggleSession.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setConfirmToggleSession(null);
      await loadSessions(sessionsData.series.id, true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal mengubah status sesi.');
      setConfirmToggleSession(null);
    } finally {
      setTogglingSession(false);
    }
  };

  const activeCount = seriesList?.filter((s) => s.isActive).length ?? 0;
  const totalSessions = seriesList?.reduce((acc, s) => acc + (s.totalSessions || 0), 0) ?? 0;
  const totalAttendance = seriesList?.reduce((acc, s) => acc + (s.totalAttendance || 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-[#1c321d] sm:text-2xl">Kajian Rutin & Absensi Mandiri</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[#6b7a72]">
            Kelola kajian yang berulang, terbitkan sesi beserta QR absensinya untuk panitia, dan pantau daftar hadir
            jamaah (nama, email, jam absen) yang absen mandiri lewat portal <span className="font-semibold">/peserta/kajian</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAnnouncementsOpen(true)}
            title="Kelola pengumuman yang tampil di halaman peserta kajian"
            className="flex items-center gap-2 rounded-xl border border-[#1b4332]/20 bg-white px-4 py-2.5 text-xs font-bold text-[#1b4332] shadow-sm transition-all hover:bg-[#f2eee4] active:scale-98"
          >
            <Megaphone className="h-4 w-4 text-[#b58b3c]" />
            Pengumuman
          </button>
          <div className="flex items-center gap-1 rounded-xl border border-[#1b4332]/15 bg-white p-1 shadow-sm" role="group" aria-label="Mode tampilan">
            <button
              type="button"
              onClick={() => switchViewMode('card')}
              title="Tampilan kartu"
              aria-pressed={viewMode === 'card'}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-all ${
                viewMode === 'card' ? 'bg-[#1b4332] text-white' : 'text-[#6b7a72] hover:bg-[#f2eee4]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kartu
            </button>
            <button
              type="button"
              onClick={() => switchViewMode('table')}
              title="Tampilan tabel"
              aria-pressed={viewMode === 'table'}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-all ${
                viewMode === 'table' ? 'bg-[#1b4332] text-white' : 'text-[#6b7a72] hover:bg-[#f2eee4]'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" /> Tabel
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingSeries(null);
              setSeriesError('');
              setSeriesModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#1b4332] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#14352a] active:scale-98"
          >
            <CalendarPlus className="h-4 w-4 text-[#e0b970]" />
            Kajian Rutin Baru
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Kajian Aktif', value: activeCount, icon: Activity },
          { label: 'Total Sesi', value: totalSessions, icon: Layers },
          { label: 'Total Absensi', value: totalAttendance, icon: Table2 },
          { label: 'Total Peserta', value: totalUniqueAttendees ?? 0, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#1b4332]/12 bg-white p-4 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f2eee4]">
              <Icon className="h-4 w-4 text-[#1b4332]" />
            </div>
            <div>
              <p className="font-display text-lg font-black leading-none text-[#1c321d]">{value}</p>
              <p className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#8a9690]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Notice / error */}
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12.5px] font-medium text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Tutup" className="font-bold opacity-60 hover:opacity-100">×</button>
        </div>
      )}
      {listError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-800">{listError}</div>
      )}

      {/* Daftar seri */}
      {!seriesList && !listError && (
        <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#1b4332]/12 bg-white p-10 text-sm text-[#6b7a72] shadow-sm">
          <LoaderCircle className="h-4 w-4 animate-spin text-[#1b4332]" /> Memuat kajian rutin…
        </div>
      )}

      {seriesList && seriesList.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#1b4332]/25 bg-white/60 p-10 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-[#8a9690]" />
          <p className="mt-3 font-display text-base font-bold text-[#1c321d]">Belum ada kajian rutin</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-[#6b7a72]">
            Buat kajian rutin pertama Anda — misalnya “Kajian Ahad Pagi”. Setelah itu buat sesi mingguan, cetak QR-nya,
            dan jamaah tinggal scan + login Google untuk absen.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingSeries(null);
              setSeriesError('');
              setSeriesModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1b4332] px-4 py-2.5 text-xs font-bold text-white"
          >
            <CalendarPlus className="h-4 w-4 text-[#e0b970]" /> Buat Kajian Rutin
          </button>
        </div>
      )}

      <div className={viewMode === 'table' ? 'hidden' : 'space-y-3'}>
        {seriesList?.map((series) => {
          const isExpanded = expandedId === series.id;
          return (
            <div key={series.id} className="overflow-hidden rounded-2xl border border-[#1b4332]/12 bg-white shadow-sm">
              {/* Baris seri */}
              <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => toggleExpand(series.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-expanded={isExpanded}
                >
                  {series.posterUrl ? (
                    <img src={series.posterUrl} alt={`Poster ${series.title}`} className="h-10 w-10 shrink-0 rounded-xl border border-[#e7e4d8] object-cover" />
                  ) : null}
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${series.isActive ? 'bg-[#1b4332]' : 'bg-[#d5d1c1]'}`}>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-white" /> : <ChevronRight className="h-4 w-4 text-white" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-[14.5px] font-bold text-[#1c321d]">{series.title}</p>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${series.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f2eee4] text-[#8a9690]'}`}>
                        {series.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                      {series.targetAudience !== 'umum' && (
                        <span className="rounded-md bg-[#f2eee4] px-2 py-0.5 text-[10px] font-bold text-[#6b7a72]">
                          {TARGET_AUDIENCE_LABELS[series.targetAudience]}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-[#6b7a72]">
                      {describeJadwal(series)}
                      {series.locationName ? ` • ${series.locationName}` : ''}
                      {series.speaker ? ` • ${series.speaker}` : ''}
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-lg bg-[#f2eee4] px-2.5 py-1 font-bold text-[#3d4a44]">{series.totalSessions || 0} sesi</span>
                  <span className="rounded-lg bg-[#f2eee4] px-2.5 py-1 font-bold text-[#3d4a44]">{series.totalAttendance || 0} absensi</span>
                  {series.nextSessionDate && (
                    <span className="rounded-lg bg-[#1b4332] px-2.5 py-1 font-bold text-white">
                      Berikutnya: {formatWibShortDate(`${series.nextSessionDate}T00:00:00+07:00`)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSeries(series);
                      setSeriesError('');
                      setSeriesModalOpen(true);
                    }}
                    title="Ubah kajian rutin"
                    className="rounded-lg border border-[#1b4332]/15 bg-white p-2 text-[#3d4a44] hover:bg-[#f2eee4]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleSeriesActive(series)}
                    title={series.isActive ? 'Nonaktifkan dari portal jamaah' : 'Aktifkan kembali'}
                    className="rounded-lg border border-[#1b4332]/15 bg-white p-2 text-[#3d4a44] hover:bg-amber-50 hover:text-amber-700"
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteSeries(series)}
                    title="Hapus kajian rutin"
                    className="rounded-lg border border-[#1b4332]/15 bg-white p-2 text-[#3d4a44] hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Panel sesi */}
              {isExpanded && (
                <div className="border-t border-[#e7e4d8] bg-[#fbfaf6] p-4 sm:p-5">
                  <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8a9690]">Sesi & QR Absensi</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddSession((prev) => !prev)}
                        className="flex items-center gap-1.5 rounded-xl bg-[#1b4332] px-3.5 py-2 text-[11.5px] font-bold text-white hover:bg-[#14352a]"
                      >
                        {showAddSession ? <X className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5 text-[#e0b970]" />}
                        {showAddSession ? 'Tutup Form' : 'Tambah Sesi'}
                      </button>
                      <div className="flex items-center gap-1.5 rounded-xl border border-[#1b4332]/15 bg-white px-2.5 py-1.5">
                        <Wand2 className="h-3.5 w-3.5 text-[#b58b3c]" />
                        <select value={genCount} onChange={(e) => setGenCount(e.target.value)} className="bg-transparent text-[11.5px] font-bold text-[#1c321d] focus:outline-none">
                          <option value="4">4 sesi</option>
                          <option value="8">8 sesi</option>
                          <option value="12">12 sesi</option>
                        </select>
                        <button
                          type="button"
                          onClick={generateSessions}
                          disabled={generating}
                          className="text-[11.5px] font-black text-[#1b4332] underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          {generating ? 'Memproses…' : 'Generate'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {showAddSession && (
                    <div className="mb-4 rounded-2xl border border-[#e7e4d8] bg-white p-4">
                      <p className="mb-2.5 text-[12px] font-bold text-[#1c321d]">Tambah Sesi Individual</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className={`${inputClass} sm:w-44`} />
                        <input value={newSessionTopic} onChange={(e) => setNewSessionTopic(e.target.value)} placeholder="Tema / materi (opsional)" maxLength={200} className={inputClass} />
                        <button
                          type="button"
                          onClick={addSession}
                          disabled={addingSession}
                          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1b4332] px-4 py-2 text-xs font-bold text-white hover:bg-[#14352a] disabled:opacity-50"
                        >
                          {addingSession ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                          Buat Sesi
                        </button>
                      </div>
                      <p className="mt-2 text-[10.5px] text-[#8a9690]">
                        Kosongkan tanggal untuk memakai sesi berikutnya yang belum ada (mengikuti hari & pola ulang di atas).
                      </p>
                    </div>
                  )}

                  {/* Jamaah paling tepat waktu (30 hari) */}
                  {earlyBirdsLoading && (
                    <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] font-semibold text-[#92610c]">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Menghitung jamaah paling tepat waktu…
                    </div>
                  )}
                  {!earlyBirdsLoading && earlyBirds && earlyBirds.seriesId === series.id && (
                    earlyBirds.items.length > 0 ? (
                      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-[11.5px] font-black uppercase tracking-wider text-[#92610c]">
                          🏅 Jamaah Paling Tepat Waktu — {earlyBirds.days} hari terakhir ({earlyBirds.sessionsCount} sesi)
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {earlyBirds.items.map((bird, idx) => (
                            <span
                              key={`${bird.email || bird.fullName}-${idx}`}
                              title={`Masuk 10 besar tercepat ${bird.early}× dari ${bird.attended} kehadiran`}
                              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold ${
                                idx === 0
                                  ? 'border-amber-400 bg-amber-100 text-amber-900'
                                  : 'border-amber-200 bg-white text-[#7a5d1e]'
                              }`}
                            >
                              {idx === 0 ? '🥇' : `🏅${idx + 1}`} {bird.fullName}
                              <span className="font-mono text-[10px] opacity-75">{bird.early}× tercepat / {bird.attended}× hadir</span>
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-[10.5px] leading-relaxed text-[#a07a2c]">
                          Diurutkan dari yang paling sering masuk 10 besar absensi tercepat pada tiap sesi. Cocok untuk apresiasi/doa panitia.
                        </p>
                      </div>
                    ) : earlyBirds.sessionsCount === 0 ? (
                      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] font-semibold text-[#92610c]">
                        Belum ada sesi dalam 30 hari terakhir — belum bisa dihitung jamaah paling tepat waktu.
                      </div>
                    ) : null
                  )}

                  {sessionsLoading && (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#6b7a72]">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat sesi…
                    </div>
                  )}

                  {sessionsData && sessionsData.series.id === series.id && (
                    <div className="overflow-hidden rounded-2xl border border-[#e7e4d8] bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12.5px]">
                          <thead>
                            <tr className="border-b border-[#e7e4d8] bg-[#fbfaf6] text-[10.5px] font-black uppercase tracking-wider text-[#6b7a72]">
                              <th className="px-3 py-2.5">Tanggal</th>
                              <th className="px-3 py-2.5">Jadwal</th>
                              <th className="px-3 py-2.5">Tema</th>
                              <th className="px-3 py-2.5">Status</th>
                              <th className="px-3 py-2.5">Hadir</th>
                              <th className="px-3 py-2.5 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f0eee6]">
                            {sessionsData.sessions.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-[#8a9690]">
                                  Belum ada sesi. Klik <strong>Tambah Sesi</strong> atau <strong>Generate</strong> untuk membuat jadwal otomatis.
                                </td>
                              </tr>
                            )}
                            {sessionsData.sessions.map((session) => (
                              <tr key={session.id} className="hover:bg-[#fbfaf6]">
                                <td className="px-3 py-2.5">
                                  <p className="font-bold text-[#1c321d]">{formatWibShortDate(`${session.sessionDate}T00:00:00+07:00`)}</p>
                                  <p className="text-[10.5px] text-[#8a9690]">{weekdayLabel(session.sessionDate)}</p>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-[11.5px] text-[#4b5a52]">
                                  {sessionsData.series.startTime}
                                  {sessionsData.series.endTime ? ` – ${sessionsData.series.endTime}` : ''} WIB
                                </td>
                                <td className="max-w-[220px] px-3 py-2.5 text-[#4b5a52]">
                                  <span className="line-clamp-1">{session.topic || '—'}</span>
                                </td>
                                <td className="px-3 py-2.5">{statusBadge(session)}</td>
                                <td className="px-3 py-2.5 font-bold text-[#1b4332]">{session.attendanceCount ?? 0}</td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setQrSession(session)}
                                      disabled={session.status === 'cancelled'}
                                      title="QR absensi sesi ini"
                                      className="flex items-center gap-1.5 rounded-lg bg-[#1b4332] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#14352a] disabled:opacity-40"
                                    >
                                      <QrCode className="h-3.5 w-3.5" /> QR
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSession(session)}
                                      disabled={session.status === 'cancelled'}
                                      title="Ubah tanggal/jam/lokasi/pemateri pertemuan"
                                      className="flex items-center gap-1.5 rounded-lg border border-[#1b4332]/15 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#1b4332] hover:bg-[#f2eee4] disabled:opacity-40"
                                    >
                                      <Pencil className="h-3.5 w-3.5" /> Ubah
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAttendanceSessionId(session.id)}
                                      title="Daftar hadir sesi ini"
                                      className="flex items-center gap-1.5 rounded-lg border border-[#1b4332]/15 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#1b4332] hover:bg-[#f2eee4]"
                                    >
                                      <Table2 className="h-3.5 w-3.5" /> Absensi
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmToggleSession(session)}
                                      title={session.status === 'cancelled' ? 'Buka kembali sesi' : 'Batalkan sesi'}
                                      className="rounded-lg p-1.5 text-[#8a9690] hover:bg-amber-50 hover:text-amber-700"
                                    >
                                      <Power className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="mt-3.5 flex items-start gap-2 rounded-2xl border border-[#e0b970]/40 bg-[#fbf6e9] p-3.5 text-[11.5px] leading-relaxed text-[#7a5d1e]">
                    <QrCode className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      <strong>Alur absensi jamaah:</strong> panitia membuka QR sesi → mencetak/menampilkannya di pintu →
                      jamaah scan → diarahkan ke halaman <strong>/peserta/kajian</strong> → login akun Google → tekan
                      Absen. Semua hadir muncul otomatis di tabel Absensi, lengkap dengan jam absen WIB.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tampilan tabel */}
      {viewMode === 'table' && seriesList && seriesList.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#1b4332]/12 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e7e4d8] bg-[#fbfaf6] text-[10.5px] font-black uppercase tracking-wider text-[#6b7a72]">
                  <th className="px-4 py-3">Kajian Rutin</th>
                  <th className="px-4 py-3">Pemateri</th>
                  <th className="px-4 py-3">Sesi</th>
                  <th className="px-4 py-3">Peserta</th>
                  <th className="px-4 py-3">Absensi</th>
                  <th className="px-4 py-3">Berikutnya</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eee6]">
                {seriesList.map((series) => (
                  <tr key={series.id} className="hover:bg-[#fbfaf6]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {series.posterUrl ? (
                          <img src={series.posterUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-[#e7e4d8] object-cover" />
                        ) : (
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${series.isActive ? 'bg-[#1b4332]' : 'bg-[#d5d1c1]'}`}>
                            <CalendarDays className="h-4 w-4 text-white" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#1c321d]">{series.title}</p>
                          <p className="truncate text-[10.5px] text-[#8a9690]">{describeJadwal(series)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#4b5a52]">{series.speaker || '—'}</td>
                    <td className="px-4 py-3 font-bold text-[#1b4332]">{series.totalSessions || 0}</td>
                    <td className="px-4 py-3 font-bold text-[#1b4332]" title="Peserta unik (akun Google berbeda)">
                      {series.uniqueAttendees ?? 0}
                    </td>
                    <td className="px-4 py-3 text-[#4b5a52]">{series.totalAttendance || 0}</td>
                    <td className="px-4 py-3">
                      {series.nextSessionDate ? (
                        <span className="rounded-lg bg-[#1b4332] px-2 py-1 text-[10.5px] font-bold text-white">
                          {formatWibShortDate(`${series.nextSessionDate}T00:00:00+07:00`)}
                        </span>
                      ) : (
                        <span className="text-[#8a9690]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-bold ${series.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f2eee4] text-[#8a9690]'}`}>
                        {series.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openSeriesFromTable(series.id)}
                          title="Kelola sesi & QR"
                          className="flex items-center gap-1.5 rounded-lg bg-[#1b4332] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#14352a]"
                        >
                          <QrCode className="h-3.5 w-3.5" /> Kelola
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSeries(series);
                            setSeriesError('');
                            setSeriesModalOpen(true);
                          }}
                          title="Ubah kajian rutin"
                          className="rounded-lg border border-[#1b4332]/15 bg-white p-1.5 text-[#3d4a44] hover:bg-[#f2eee4]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleSeriesActive(series)}
                          title={series.isActive ? 'Nonaktifkan dari portal jamaah' : 'Aktifkan kembali'}
                          className="rounded-lg border border-[#1b4332]/15 bg-white p-1.5 text-[#3d4a44] hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSeries(series)}
                          title="Hapus kajian rutin"
                          className="rounded-lg border border-[#1b4332]/15 bg-white p-1.5 text-[#3d4a44] hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <KajianRutinSeriesModal
        isOpen={seriesModalOpen}
        series={editingSeries}
        speakers={speakers}
        saving={seriesSaving}
        error={seriesError}
        onAddSpeaker={addSpeaker}
        onSave={saveSeries}
        onClose={() => {
          setSeriesModalOpen(false);
          setEditingSeries(null);
        }}
      />

      <KajianRutinSessionEditModal
        isOpen={Boolean(editingSession) && Boolean(sessionsData)}
        session={editingSession}
        series={sessionsData?.series || null}
        speakers={speakers}
        saving={sessionSaving}
        error={sessionError}
        onSave={saveSessionEdit}
        onClose={() => setEditingSession(null)}
      />

      <KajianRutinQrModal
        session={qrSession}
        seriesTitle={sessionsData?.series.title || qrSession?.seriesId || 'Kajian Rutin'}
        onClose={() => setQrSession(null)}
        onRotated={(updated) => {
          setQrSession(updated);
          if (sessionsData && updated.seriesId === sessionsData.series.id) void loadSessions(updated.seriesId, true);
        }}
      />

      <KajianRutinAttendanceModal sessionId={attendanceSessionId} onClose={() => setAttendanceSessionId(null)} />

      <KajianRutinAnnouncementsModal isOpen={announcementsOpen} onClose={() => setAnnouncementsOpen(false)} />

      <ConfirmDialog
        isOpen={Boolean(confirmDeleteSeries)}
        variant="danger"
        title="Hapus Kajian Rutin?"
        message={confirmDeleteSeries ? `“${confirmDeleteSeries.title}” beserta seluruh sesi, QR, dan data absensinya akan dihapus permanen.` : ''}
        confirmLabel="Ya, Hapus Semua"
        loading={deletingSeries}
        onConfirm={deleteSeries}
        onClose={() => setConfirmDeleteSeries(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmToggleSession)}
        variant={confirmToggleSession?.status === 'cancelled' ? 'info' : 'warning'}
        title={confirmToggleSession?.status === 'cancelled' ? 'Buka Kembali Sesi?' : 'Batalkan Sesi?'}
        message={
          confirmToggleSession
            ? confirmToggleSession.status === 'cancelled'
              ? `Sesi ${formatWibDate(`${confirmToggleSession.sessionDate}T00:00:00+07:00`)} akan kembali terbuka untuk absensi jamaah.`
              : `Sesi ${formatWibDate(`${confirmToggleSession.sessionDate}T00:00:00+07:00`)} akan dibatalkan — QR tidak bisa dipakai dan jamaah tidak dapat absen. Data absensi yang sudah masuk tetap tersimpan.`
            : ''
        }
        confirmLabel={confirmToggleSession?.status === 'cancelled' ? 'Ya, Buka Kembali' : 'Ya, Batalkan Sesi'}
        loading={togglingSession}
        onConfirm={toggleSessionStatus}
        onClose={() => setConfirmToggleSession(null)}
      />
    </div>
  );
}

export default KajianRutinPage;
