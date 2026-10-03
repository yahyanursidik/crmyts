import { useEffect, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import type { KajianRutinSeries, KajianRutinSession, KajianRutinSpeaker } from '../../lib/kajianRutin';

/**
 * Ubah satu pertemuan: tanggal, jam, lokasi, pemateri, tema & status bisa
 * dibedakan dari pola seri (jadwal per sesi fleksibel). Kolom yang dikosongkan
 * mengikuti nilai seri.
 */
export function KajianRutinSessionEditModal({
  isOpen,
  session,
  series,
  speakers,
  saving,
  error,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  session: KajianRutinSession | null;
  series: KajianRutinSeries | null;
  speakers: KajianRutinSpeaker[];
  saving: boolean;
  error: string;
  onSave: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    sessionDate: '',
    startTime: '',
    endTime: '',
    locationName: '',
    speaker: '',
    topic: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen && session) {
      setForm({
        sessionDate: session.sessionDate,
        startTime: session.startTime || '',
        endTime: session.endTime || '',
        locationName: session.locationName || '',
        speaker: session.speaker || '',
        topic: session.topic || '',
        notes: session.notes || '',
      });
    }
  }, [isOpen, session]);

  if (!isOpen || !session || !series) return null;

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const speakerOptions = Array.from(new Set([...speakers.map((s) => s.name), series.speaker || '', session.speaker || ''])).filter(Boolean);

  const handleSubmit = () => {
    onSave({
      sessionDate: form.sessionDate,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      locationName: form.locationName.trim() || null,
      speaker: form.speaker.trim() || null,
      topic: form.topic.trim() || null,
      notes: form.notes.trim() || null,
    });
  };

  const inputClass =
    'min-h-10 w-full rounded-lg border border-[#d5d1c1] bg-white px-3 py-2 text-sm text-[#1c321d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365e38]';
  const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b7a72]';

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-[#0f3a2e]/60 p-4 backdrop-blur-xs sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-3xl border border-[#e7e4d8] bg-[#fbfaf6] shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-[#e7e4d8] px-6 py-4">
          <div>
            <h3 className="font-display text-base font-black text-[#1c321d]">Ubah Pertemuan</h3>
            <p className="text-[11px] text-[#8a9690]">
              Kolom jam/lokasi/pemateri yang dikosongkan mengikuti nilai seri ({series.startTime} WIB{series.endTime ? `–${series.endTime}` : ''}).
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-[#8a9690] hover:bg-[#f2eee4] hover:text-[#1c321d]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-800">{error}</div>}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="ks-date">Tanggal *</label>
              <input id="ks-date" type="date" className={inputClass} value={form.sessionDate} onChange={(e) => set('sessionDate', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ks-start">Jam Mulai (WIB)</label>
              <input id="ks-start" type="time" className={inputClass} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} placeholder={series.startTime} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ks-end">Jam Selesai (WIB)</label>
              <input id="ks-end" type="time" className={inputClass} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} placeholder={series.endTime || series.startTime} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="ks-loc">Lokasi Pertemuan</label>
              <input id="ks-loc" className={inputClass} value={form.locationName} onChange={(e) => set('locationName', e.target.value)}
                placeholder={series.locationName || 'cth. Masjid Tarbiyah Sunnah'} maxLength={160} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ks-speaker">Pemateri Pertemuan</label>
              <select id="ks-speaker" className={inputClass} value={form.speaker} onChange={(e) => set('speaker', e.target.value)}>
                <option value="">Ikuti seri{series.speaker ? `: ${series.speaker}` : ''}</option>
                {speakerOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ks-topic">Tema / Materi</label>
            <input id="ks-topic" className={inputClass} value={form.topic} onChange={(e) => set('topic', e.target.value)} maxLength={200} />
          </div>

          <div>
            <label className={labelClass} htmlFor="ks-notes">Catatan</label>
            <textarea id="ks-notes" className={`${inputClass} min-h-20`} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#e7e4d8] px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-xl border border-[#e7e4d8] bg-white px-4 py-2.5 text-xs font-bold text-[#3d4a44] shadow-2xs transition-all hover:bg-[#f2eee4]">
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || !form.sessionDate}
            className="flex items-center gap-2 rounded-xl bg-[#1b4332] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#14352a] active:scale-95 disabled:opacity-50">
            {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            Simpan Pertemuan
          </button>
        </div>
      </div>
    </div>
  );
}
