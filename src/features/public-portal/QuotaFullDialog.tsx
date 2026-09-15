import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface QuotaFullDialogProps {
  message: string | null;
  eventTitle?: string | null;
  onClose: () => void;
  variant?: 'quota' | 'service';
}

export const QuotaFullDialog: React.FC<QuotaFullDialogProps> = ({ message, eventTitle, onClose, variant = 'quota' }) => {
  if (!message) return null;

  const isQuota = variant === 'quota';
  const title = isQuota ? 'Kuota kajian sudah penuh' : 'Pendaftaran sedang terkendala';
  const eyebrow = isQuota ? 'Pendaftaran Belum Diproses' : 'Gangguan Layanan';
  const description = isQuota
    ? 'Terima kasih atas antusiasmenya. Slot yang tersedia baru saja habis, sehingga data dan tiket Anda belum dibuat.'
    : 'Data dan tiket Anda belum dibuat. Silakan coba lagi setelah beberapa saat.';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quota-dialog-title">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-amber-100 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><AlertCircle className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold uppercase tracking-wide text-amber-800">{eyebrow}</p><h2 id="quota-dialog-title" className="mt-0.5 text-lg font-bold text-slate-900">{title}</h2></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-100 hover:text-slate-900" aria-label="Tutup pemberitahuan kuota penuh"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5 py-5 text-sm leading-relaxed text-slate-600">
          {eventTitle && <p className="font-semibold text-slate-900">{eventTitle}</p>}
          <p>{description}</p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-950">{message}</p>
          <p className="text-xs text-slate-500">{isQuota ? 'Silakan pilih jadwal kajian lain atau hubungi panitia bila memerlukan informasi lebih lanjut.' : 'Bila masalah berlanjut, hubungi panitia dan sertakan waktu pendaftaran Anda.'}</p>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-3"><button type="button" onClick={onClose} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white hover:bg-teal-900">Saya Mengerti</button></div>
      </section>
    </div>
  );
};
