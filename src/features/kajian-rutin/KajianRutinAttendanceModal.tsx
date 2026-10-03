import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, LoaderCircle, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import { apiClient, ApiClientError } from '../../lib/apiClient';
import {
  formatWibDate,
  formatWibTime,
  SOURCE_LABELS,
  type KajianRutinAttendanceRow,
  type KajianRutinSession,
  type KajianRutinSeries,
} from '../../lib/kajianRutin';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

interface AttendancePayload {
  session: KajianRutinSession;
  series: KajianRutinSeries;
  items: KajianRutinAttendanceRow[];
  checkInWindow: { openAt: string; closeAt: string };
}

const inputClass =
  'min-h-9 w-full rounded-lg border border-[#d5d1c1] bg-white px-3 py-1.5 text-[13px] text-[#1c321d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365e38]';

function buildCsv(rows: KajianRutinAttendanceRow[]): string {
  const header = ['No', 'Nama', 'Email', 'Telepon', 'Jam Absen (WIB)', 'Sumber', 'Status', 'Catatan'];
  const escape = (value: string | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((row, idx) =>
    [
      String(idx + 1),
      escape(row.fullName),
      escape(row.email),
      escape(row.phone),
      escape(formatWibTime(row.checkInAt)),
      escape(SOURCE_LABELS[row.source] || row.source),
      escape(row.status === 'present' ? 'Hadir' : row.status),
      escape(row.note),
    ].join(',')
  );
  return `\uFEFF${header.join(',')}\n${lines.join('\n')}`;
}

export function KajianRutinAttendanceModal({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<AttendancePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<KajianRutinAttendanceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (id: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await apiClient<AttendancePayload>(`/kajian-rutin/sessions/${id}/attendance`);
      setPayload(data);
      setError('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memuat data absensi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setPayload(null);
      setSearch('');
      setManualName('');
      setManualEmail('');
      setManualError('');
      setError('');
      return;
    }
    void load(sessionId);
  }, [sessionId, load]);

  const filtered = useMemo(() => {
    if (!payload) return [];
    const q = search.trim().toLowerCase();
    if (!q) return payload.items;
    return payload.items.filter(
      (row) => row.fullName.toLowerCase().includes(q) || (row.email || '').toLowerCase().includes(q)
    );
  }, [payload, search]);

  if (!sessionId) return null;

  const addManual = async () => {
    setManualSaving(true);
    setManualError('');
    try {
      await apiClient(`/kajian-rutin/sessions/${sessionId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ fullName: manualName.trim(), email: manualEmail.trim() || null }),
      });
      setManualName('');
      setManualEmail('');
      await load(sessionId, true);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Gagal menambah peserta.');
    } finally {
      setManualSaving(false);
    }
  };

  const deleteRow = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/kajian-rutin/attendance/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load(sessionId, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data absensi.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const downloadCsv = () => {
    if (!payload) return;
    const csv = buildCsv(payload.items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `absensi-${payload.series.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${payload.session.sessionDate}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const windowInfo = payload
    ? `Absensi dibuka ${formatWibTime(payload.checkInWindow.openAt)} – ${formatWibTime(payload.checkInWindow.closeAt)}`
    : '';

  return (
    <div className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-[#0f3a2e]/60 p-4 backdrop-blur-xs sm:p-8" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-4xl rounded-3xl border border-[#e7e4d8] bg-[#fbfaf6] shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between border-b border-[#e7e4d8] px-6 py-4">
          <div>
            <h3 className="font-display text-base font-black text-[#1c321d]">Daftar Absensi Peserta</h3>
            {payload && (
              <p className="text-[11px] text-[#8a9690]">
                {payload.series.title} • {formatWibDate(payload.session.startAt)}
                {payload.session.topic ? ` • ${payload.session.topic}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={downloadCsv} disabled={!payload || payload.items.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-[#1b4332]/15 bg-white px-3 py-2 text-xs font-bold text-[#1b4332] hover:bg-[#f2eee4] disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button onClick={onClose} className="rounded-xl p-2 text-[#8a9690] hover:bg-[#f2eee4] hover:text-[#1c321d]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-800">{error}</div>}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#6b7a72]">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat absensi…
            </div>
          )}

          {payload && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold">
                  <span className="rounded-lg bg-[#1b4332] px-2.5 py-1 text-white">Hadir: {payload.items.length}</span>
                  <span className="rounded-lg bg-[#f2eee4] px-2.5 py-1 text-[#3d4a44]">
                    Scan QR: {payload.items.filter((r) => r.source === 'qr_self_scan').length}
                  </span>
                  <span className="rounded-lg bg-[#f2eee4] px-2.5 py-1 text-[#3d4a44]">
                    Portal: {payload.items.filter((r) => r.source === 'portal_self_scan').length}
                  </span>
                  <span className="rounded-lg bg-[#f2eee4] px-2.5 py-1 text-[#3d4a44]">
                    Manual: {payload.items.filter((r) => r.source === 'manual_input').length}
                  </span>
                  <span className="text-[10.5px] font-normal text-[#8a9690]">{windowInfo}</span>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a9690]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / email…"
                    className={`${inputClass} pl-8`} />
                </div>
              </div>

              {/* Tambah manual */}
              <div className="rounded-2xl border border-[#e7e4d8] bg-white p-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-bold text-[#1c321d]">
                  <UserPlus className="h-3.5 w-3.5 text-[#1b4332]" /> Tambah Absensi Manual (tanpa akun Google)
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className={inputClass} value={manualName} onChange={(e) => setManualName(e.target.value)}
                    placeholder="Nama lengkap jamaah *" maxLength={160} />
                  <input className={inputClass} value={manualEmail} onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="Email (opsional)" type="email" maxLength={254} />
                  <button type="button" onClick={addManual} disabled={manualSaving || manualName.trim().length < 2}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1b4332] px-4 py-2 text-xs font-bold text-white hover:bg-[#14352a] disabled:opacity-50">
                    {manualSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Tambah
                  </button>
                </div>
                {manualError && <p className="mt-2 text-[11.5px] font-semibold text-rose-700">{manualError}</p>}
              </div>

              {/* Tabel absensi */}
              <div className="overflow-hidden rounded-2xl border border-[#e7e4d8] bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-[#e7e4d8] bg-[#fbfaf6] text-[10.5px] font-black uppercase tracking-wider text-[#6b7a72]">
                        <th className="px-3 py-2.5">No</th>
                        <th className="px-3 py-2.5">Nama</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Jam Absen</th>
                        <th className="px-3 py-2.5">Sumber</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0eee6]">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-[#8a9690]">
                            {payload.items.length === 0
                              ? 'Belum ada jamaah yang absen untuk sesi ini.'
                              : 'Tidak ada hasil yang cocok dengan pencarian.'}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-[#fbfaf6]">
                            <td className="px-3 py-2.5 font-mono text-[11px] text-[#8a9690]">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-bold text-[#1c321d]">{row.fullName}</td>
                            <td className="px-3 py-2.5 text-[#4b5a52]">{row.email || '—'}</td>
                            <td className="px-3 py-2.5 font-mono text-[11.5px] font-bold text-[#1b4332]">{formatWibTime(row.checkInAt)}</td>
                            <td className="px-3 py-2.5">
                              <span className="rounded-md bg-[#f2eee4] px-2 py-0.5 text-[10.5px] font-bold text-[#3d4a44]">
                                {SOURCE_LABELS[row.source] || row.source}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-bold ${row.status === 'present' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                                {row.status === 'present' ? 'Hadir' : row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button type="button" onClick={() => setDeleteTarget(row)} title="Hapus absensi"
                                className="rounded-lg p-1.5 text-[#8a9690] hover:bg-rose-50 hover:text-rose-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        variant="danger"
        title="Hapus Data Absensi?"
        message={deleteTarget ? `Absensi ${deleteTarget.fullName} akan dihapus dari sesi ini. Jamaah dapat absen ulang bila jendela absensi masih terbuka.` : ''}
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={deleteRow}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
