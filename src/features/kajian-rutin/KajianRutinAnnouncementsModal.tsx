import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Megaphone, Pencil, Pin, Plus, Trash2, X } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { formatWibShortDate, type KajianRutinAnnouncement } from '../../lib/kajianRutin';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

const inputClass =
  'min-h-10 w-full rounded-lg border border-[#d5d1c1] bg-white px-3 py-2 text-sm text-[#1c321d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365e38]';
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b7a72]';

/**
 * Kelola pengumuman YTS yang tampil di kolom pengumuman halaman peserta
 * kajian: buat, ubah, sematkan, aktif/nonaktif, dan hapus.
 */
export function KajianRutinAnnouncementsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<KajianRutinAnnouncement[] | null>(null);
  const [listError, setListError] = useState('');
  const [form, setForm] = useState<{ title: string; body: string; isPinned: boolean; isActive: boolean }>({
    title: '',
    body: '',
    isPinned: false,
    isActive: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<KajianRutinAnnouncement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient<KajianRutinAnnouncement[]>('/kajian-rutin/announcements');
      setItems(data);
      setListError('');
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Gagal memuat pengumuman.');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setItems(null);
      setEditingId(null);
      setForm({ title: '', body: '', isPinned: false, isActive: true });
      setFormError('');
      void load();
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  const startEdit = (item: KajianRutinAnnouncement) => {
    setEditingId(item.id);
    setForm({ title: item.title, body: item.body, isPinned: item.isPinned, isActive: item.isActive });
    setFormError('');
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: '', body: '', isPinned: false, isActive: true });
    setFormError('');
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFormError('');
    try {
      const payload = JSON.stringify({
        title: form.title.trim(),
        body: form.body.trim(),
        isPinned: form.isPinned,
        isActive: form.isActive,
      });
      if (editingId) {
        await apiClient(`/kajian-rutin/announcements/${editingId}`, { method: 'PATCH', body: payload });
      } else {
        await apiClient('/kajian-rutin/announcements', { method: 'POST', body: payload });
      }
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan pengumuman.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: KajianRutinAnnouncement) => {
    try {
      await apiClient(`/kajian-rutin/announcements/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Gagal mengubah status pengumuman.');
    }
  };

  const togglePinned = async (item: KajianRutinAnnouncement) => {
    try {
      await apiClient(`/kajian-rutin/announcements/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned: !item.isPinned }),
      });
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Gagal menyematkan pengumuman.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient(`/kajian-rutin/announcements/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Gagal menghapus pengumuman.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-[#0f3a2e]/60 p-4 backdrop-blur-xs sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-3xl border border-[#e7e4d8] bg-[#fbfaf6] shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-[#e7e4d8] px-6 py-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-black text-[#1c321d]">
              <Megaphone className="h-4 w-4 text-[#b58b3c]" /> Pengumuman untuk Jamaah
            </h3>
            <p className="text-[11px] text-[#8a9690]">Tampil di kolom pengumuman halaman peserta kajian (/peserta/kajian).</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-[#8a9690] hover:bg-[#f2eee4] hover:text-[#1c321d]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          {/* Form buat/ubah */}
          <div className="rounded-2xl border border-[#e7e4d8] bg-white p-4">
            <p className="mb-2.5 text-[12px] font-bold text-[#1c321d]">
              {editingId ? 'Ubah Pengumuman' : 'Pengumuman Baru'}
            </p>
            {formError && <div className="mb-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="ka-title">Judul *</label>
                <input id="ka-title" className={inputClass} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="cth. Perubahan jam kajian Ahad" maxLength={160} />
              </div>
              <div>
                <label className={labelClass} htmlFor="ka-body">Isi Pengumuman *</label>
                <textarea id="ka-body" className={`${inputClass} min-h-24`} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  placeholder="Tulis isi pengumuman untuk jamaah…" maxLength={2000} />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-[#1c321d]">
                  <input type="checkbox" className="h-4 w-4 accent-[#1b4332]" checked={form.isPinned}
                    onChange={(e) => setForm((p) => ({ ...p, isPinned: e.target.checked }))} />
                  Sematkan di atas (Pinned)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-[#1c321d]">
                  <input type="checkbox" className="h-4 w-4 accent-[#1b4332]" checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                  Aktif (tampil ke jamaah)
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                {editingId && (
                  <button type="button" onClick={resetForm}
                    className="rounded-xl border border-[#e7e4d8] bg-white px-4 py-2 text-xs font-bold text-[#3d4a44] hover:bg-[#f2eee4]">
                    Batal Ubah
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || form.title.trim().length < 3 || form.body.trim().length < 5}
                  className="flex items-center gap-2 rounded-xl bg-[#1b4332] px-4 py-2 text-xs font-bold text-white hover:bg-[#14352a] disabled:opacity-50"
                >
                  {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {editingId ? 'Simpan Perubahan' : 'Terbitkan Pengumuman'}
                </button>
              </div>
            </div>
          </div>

          {/* Daftar pengumuman */}
          <p className="rounded-xl border border-[#B58B3C]/30 bg-[#FBF6E9] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#7A5D1E]">
            Hanya pengumuman berstatus <strong>AKTIF</strong> yang tampil di halaman jamaah. Gunakan tombol mata untuk
            menampilkan/menyembunyikan tanpa menghapus.
          </p>
          {listError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-800">{listError}</div>}
          {!items && !listError && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#6b7a72]">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat pengumuman…
            </div>
          )}
          {items && items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[#1b4332]/25 bg-white/60 p-6 text-center text-[12.5px] text-[#6b7a72]">
              Belum ada pengumuman. Terbitkan yang pertama — langsung tampil di halaman jamaah.
            </p>
          )}
          {items && items.length > 0 && (
            <div className="space-y-2.5">
              {items.map((item) => (
                <div key={item.id} className={`rounded-2xl border p-4 ${item.isActive ? 'border-[#e7e4d8] bg-white' : 'border-[#e7e4d8] bg-[#f2eee4]/50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-bold text-[#1c321d]">{item.title}</p>
                        {item.isPinned && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-800">
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </span>
                        )}
                        <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[#e7e4d8] text-[#8a9690]'}`}>
                          {item.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-[#4b5a52]">{item.body}</p>
                      <p className="mt-1.5 text-[10.5px] text-[#8a9690]">Diperbarui {formatWibShortDate(item.updatedAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => togglePinned(item)} title={item.isPinned ? 'Lepas sematan' : 'Sematkan di atas'}
                        className={`rounded-lg p-1.5 ${item.isPinned ? 'bg-amber-100 text-amber-800' : 'text-[#8a9690] hover:bg-amber-50 hover:text-amber-700'}`}>
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => toggleActive(item)} title={item.isActive ? 'Sedang tampil ke jamaah — klik untuk sembunyikan' : 'Sedang disembunyikan — klik untuk tampilkan ke jamaah'}
                        className={`rounded-lg p-1.5 ${item.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#c0b9a5] hover:bg-[#f2eee4] hover:text-[#6b7a72]'}`}>
                        {item.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={() => startEdit(item)} title="Ubah pengumuman"
                        className="rounded-lg p-1.5 text-[#8a9690] hover:bg-[#f2eee4] hover:text-[#1b4332]">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(item)} title="Hapus pengumuman"
                        className="rounded-lg p-1.5 text-[#8a9690] hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        variant="danger"
        title="Hapus Pengumuman?"
        message={deleteTarget ? `“${deleteTarget.title}” akan dihapus permanen dari halaman jamaah.` : ''}
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
