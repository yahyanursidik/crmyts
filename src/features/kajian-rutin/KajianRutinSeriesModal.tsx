import { useEffect, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import type { KajianRutinSeries } from '../../lib/kajianRutin';
import { WEEKDAY_NAMES } from '../../lib/kajianRutin';

interface SeriesFormValues {
  title: string;
  speaker: string;
  description: string;
  recurrence: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  targetAudience: 'umum' | 'ikhwan_only' | 'akhwat_only' | 'anak';
  quota: string;
  checkInOpenMinutes: string;
  checkInCloseMinutes: string;
  isActive: boolean;
}

const EMPTY_FORM: SeriesFormValues = {
  title: '',
  speaker: '',
  description: '',
  recurrence: 'weekly',
  dayOfWeek: '0',
  startTime: '07:00',
  endTime: '',
  locationName: '',
  locationAddress: '',
  targetAudience: 'umum',
  quota: '',
  checkInOpenMinutes: '240',
  checkInCloseMinutes: '300',
  isActive: true,
};

function toForm(series: KajianRutinSeries): SeriesFormValues {
  return {
    title: series.title,
    speaker: series.speaker || '',
    description: series.description || '',
    recurrence: series.recurrence,
    dayOfWeek: series.dayOfWeek === null || series.dayOfWeek === undefined ? '' : String(series.dayOfWeek),
    startTime: series.startTime,
    endTime: series.endTime || '',
    locationName: series.locationName || '',
    locationAddress: series.locationAddress || '',
    targetAudience: series.targetAudience,
    quota: series.quota === null || series.quota === undefined ? '' : String(series.quota),
    checkInOpenMinutes: String(series.checkInOpenMinutes ?? 240),
    checkInCloseMinutes: String(series.checkInCloseMinutes ?? 300),
    isActive: series.isActive,
  };
}

const inputClass =
  'min-h-10 w-full rounded-lg border border-[#d5d1c1] bg-white px-3 py-2 text-sm text-[#1c321d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365e38]';
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b7a72]';

export function KajianRutinSeriesModal({
  isOpen,
  series,
  saving,
  error,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  series: KajianRutinSeries | null;
  saving: boolean;
  error: string;
  onSave: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SeriesFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (isOpen) setForm(series ? toForm(series) : EMPTY_FORM);
  }, [isOpen, series]);

  if (!isOpen) return null;

  const set = <K extends keyof SeriesFormValues>(key: K, value: SeriesFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    onSave({
      title: form.title.trim(),
      speaker: form.speaker.trim() || null,
      description: form.description.trim() || null,
      recurrence: form.recurrence,
      dayOfWeek: form.dayOfWeek === '' ? null : Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime || null,
      locationName: form.locationName.trim() || null,
      locationAddress: form.locationAddress.trim() || null,
      targetAudience: form.targetAudience,
      quota: form.quota === '' ? null : Number(form.quota),
      checkInOpenMinutes: Number(form.checkInOpenMinutes) || 240,
      checkInCloseMinutes: Number(form.checkInCloseMinutes) || 300,
      isActive: form.isActive,
    });
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
            <h3 className="font-display text-base font-black text-[#1c321d]">
              {series ? 'Ubah Kajian Rutin' : 'Kajian Rutin Baru'}
            </h3>
            <p className="text-[11px] text-[#8a9690]">
              {series ? 'Perubahan berlaku untuk sesi berikutnya.' : 'Buat seri kajian yang berulang lalu terbitkan sesi & QR absensinya.'}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-xl p-2 text-[#8a9690] transition-colors hover:bg-[#f2eee4] hover:text-[#1c321d]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-800">{error}</div>
          )}

          <div>
            <label className={labelClass} htmlFor="kr-title">Judul Kajian *</label>
            <input id="kr-title" className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="cth. Kajian Rutin Ahad Pagi — Fiqih Ibadah" maxLength={160} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="kr-speaker">Pemateri / Ustadz</label>
              <input id="kr-speaker" className={inputClass} value={form.speaker} onChange={(e) => set('speaker', e.target.value)} maxLength={160} />
            </div>
            <div>
              <label className={labelClass} htmlFor="kr-audience">Sasaran Jamaah</label>
              <select id="kr-audience" className={inputClass} value={form.targetAudience} onChange={(e) => set('targetAudience', e.target.value as SeriesFormValues['targetAudience'])}>
                <option value="umum">Umum</option>
                <option value="ikhwan_only">Khusus Ikhwan</option>
                <option value="akhwat_only">Khusus Akhwat</option>
                <option value="anak">Anak-anak</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className={labelClass} htmlFor="kr-recurrence">Pola Ulang</label>
              <select id="kr-recurrence" className={inputClass} value={form.recurrence} onChange={(e) => set('recurrence', e.target.value as SeriesFormValues['recurrence'])}>
                <option value="weekly">Setiap pekan</option>
                <option value="biweekly">Setiap 2 pekan</option>
                <option value="monthly">Setiap bulan</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="kr-day">Hari</label>
              <select id="kr-day" className={inputClass} value={form.dayOfWeek} onChange={(e) => set('dayOfWeek', e.target.value)}>
                <option value="">— Belum ditentu —</option>
                {WEEKDAY_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="kr-start">Jam Mulai (WIB)</label>
              <input id="kr-start" type="time" className={inputClass} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="kr-end">Jam Selesai (WIB)</label>
              <input id="kr-end" type="time" className={inputClass} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="kr-loc">Nama Lokasi</label>
              <input id="kr-loc" className={inputClass} value={form.locationName} onChange={(e) => set('locationName', e.target.value)}
                placeholder="cth. Masjid Tarbiyah Sunnah" maxLength={160} />
            </div>
            <div>
              <label className={labelClass} htmlFor="kr-quota">Kuota per Sesi</label>
              <input id="kr-quota" type="number" min={0} className={inputClass} value={form.quota} onChange={(e) => set('quota', e.target.value)} placeholder="Kosongkan bila tanpa kuota" />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="kr-addr">Alamat Lokasi</label>
            <input id="kr-addr" className={inputClass} value={form.locationAddress} onChange={(e) => set('locationAddress', e.target.value)} maxLength={400} />
          </div>

          <div>
            <label className={labelClass} htmlFor="kr-desc">Deskripsi / Catatan</label>
            <textarea id="kr-desc" className={`${inputClass} min-h-20`} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="kr-open">Buka Absen (menit sebelum mulai)</label>
              <input id="kr-open" type="number" min={15} max={1440} className={inputClass} value={form.checkInOpenMinutes}
                onChange={(e) => set('checkInOpenMinutes', e.target.value)} />
              <p className="mt-1 text-[10.5px] text-[#8a9690]">Default 240 = absen bisa dilakukan mulai 4 jam sebelum kajian.</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="kr-close">Tutup Absen (menit setelah selesai)</label>
              <input id="kr-close" type="number" min={15} max={1440} className={inputClass} value={form.checkInCloseMinutes}
                onChange={(e) => set('checkInCloseMinutes', e.target.value)} />
              <p className="mt-1 text-[10.5px] text-[#8a9690]">Default 300 = absen ditutup 5 jam setelah jam selesai.</p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#e7e4d8] bg-white px-4 py-3">
            <input type="checkbox" className="h-4 w-4 accent-[#1b4332]" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            <span className="text-[12.5px] font-semibold text-[#1c321d]">Kajian aktif (tampil di portal absensi jamaah)</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#e7e4d8] px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-xl border border-[#e7e4d8] bg-white px-4 py-2.5 text-xs font-bold text-[#3d4a44] shadow-2xs transition-all hover:bg-[#f2eee4]">
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || form.title.trim().length < 3}
            className="flex items-center gap-2 rounded-xl bg-[#1b4332] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#14352a] active:scale-95 disabled:opacity-50">
            {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            {series ? 'Simpan Perubahan' : 'Buat Kajian Rutin'}
          </button>
        </div>
      </div>
    </div>
  );
}
