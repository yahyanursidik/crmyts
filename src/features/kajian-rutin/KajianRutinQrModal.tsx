import { useEffect, useState } from 'react';
import { Check, Copy, Download, LoaderCircle, Printer, RefreshCw, X } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import {
  buildKajianRutinQrUrl,
  formatWibDate,
  renderQrDataUrl,
  type KajianRutinSession,
} from '../../lib/kajianRutin';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

/**
 * Modal QR absensi: menampilkan QR berisi tautan /peserta/kajian?sesi=..&t=..
 * Panitia cukup unduh/cetak lalu pajang di pintu masuk majelis.
 */
export function KajianRutinQrModal({
  session,
  seriesTitle,
  onClose,
  onRotated,
}: {
  session: KajianRutinSession | null;
  seriesTitle: string;
  onClose: () => void;
  onRotated: (session: KajianRutinSession) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || !session.qrToken) {
      setDataUrl(null);
      setUrl('');
      return;
    }
    let active = true;
    const link = buildKajianRutinQrUrl(session.id, session.qrToken);
    setUrl(link);
    renderQrDataUrl(link)
      .then((result) => active && setDataUrl(result))
      .catch(() => active && setError('QR gagal dibuat. Coba tutup dan buka ulang modal ini.'));
    return () => {
      active = false;
    };
  }, [session]);

  if (!session) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Gagal menyalin tautan. Salin manual dari kotak teks.');
    }
  };

  const downloadQr = () => {
    if (!dataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `qr-absensi-${session.sessionDate}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const printQr = () => {
    if (!dataUrl) return;
    const printWindow = window.open('', '_blank', 'width=520,height=700');
    if (!printWindow) {
      setError('Popup diblokir browser. Izinkan popup atau gunakan Unduh PNG.');
      return;
    }
    printWindow.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>QR Absensi ${seriesTitle}</title></head>
      <body style="font-family:system-ui,sans-serif;text-align:center;padding:32px;color:#1c321d">
        <p style="margin:0;font-size:12px;letter-spacing:3px;color:#b58b3c;font-weight:700">YAYASAN TARBIYAH SUNNAH</p>
        <h1 style="margin:8px 0 2px;font-size:22px">${seriesTitle}</h1>
        <p style="margin:0 0 16px;color:#4b5a52;font-size:14px">Absensi ${formatWibDate(session.startAt)}</p>
        <img src="${dataUrl}" width="360" height="360" alt="QR Absensi" style="border:1px solid #e7e4d8;border-radius:16px;padding:12px" />
        <p style="margin:16px 0 0;color:#6b7a72;font-size:13px;max-width:380px;margin-inline:auto">
          Scan QR di atas dengan kamera HP, login dengan akun Google, lalu tekan <strong>Absen Sekarang</strong>.
        </p>
      </body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        /* biarkan panitia mencetak lewat Unduh PNG bila print gagal */
      }
    }, 350);
  };

  const rotateQr = async () => {
    setConfirmRotate(false);
    setRotating(true);
    setError('');
    try {
      const { data } = await apiClient<KajianRutinSession>(`/api/kajian-rutin/sessions/${session.id}/rotate-qr`, { method: 'POST' });
      onRotated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal merotasi QR.');
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-[#0f3a2e]/60 p-4 backdrop-blur-xs sm:p-8" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-3xl border border-[#e7e4d8] bg-[#fbfaf6] shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between border-b border-[#e7e4d8] px-6 py-4">
          <div>
            <h3 className="font-display text-base font-black text-[#1c321d]">QR Absensi Kajian</h3>
            <p className="text-[11px] text-[#8a9690]">{seriesTitle} • {formatWibDate(session.startAt)}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-[#8a9690] hover:bg-[#f2eee4] hover:text-[#1c321d]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-800">{error}</div>}

          <div className="flex justify-center">
            {dataUrl ? (
              <img src={dataUrl} alt="QR absensi kajian rutin" className="h-64 w-64 rounded-2xl border border-[#e7e4d8] bg-white p-3 shadow-sm" />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-[#e7e4d8] bg-white">
                <LoaderCircle className="h-7 w-7 animate-spin text-[#1b4332]" />
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#6b7a72]">Tautan Absensi</p>
            <div className="flex gap-2">
              <input readOnly value={url} onFocus={(e) => e.target.select()}
                className="min-h-10 flex-1 rounded-lg border border-[#d5d1c1] bg-white px-3 py-2 font-mono text-[11px] text-[#1c321d]" />
              <button type="button" onClick={copyLink} title="Salin tautan"
                className="flex items-center gap-1.5 rounded-lg border border-[#d5d1c1] bg-white px-3 text-xs font-bold text-[#3d4a44] hover:bg-[#f2eee4]">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={downloadQr} disabled={!dataUrl}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#1b4332]/15 bg-white px-3 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#f2eee4] disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> Unduh PNG
            </button>
            <button type="button" onClick={printQr} disabled={!dataUrl}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#1b4332]/15 bg-white px-3 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#f2eee4] disabled:opacity-50">
              <Printer className="h-3.5 w-3.5" /> Cetak
            </button>
          </div>

          <button type="button" onClick={() => setConfirmRotate(true)} disabled={rotating}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
            {rotating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Ganti Kode QR (Rotasi)
          </button>
          <p className="text-center text-[10.5px] leading-relaxed text-[#8a9690]">
            Gunakan rotasi bila QR lama tersebar ke pihak yang tidak diinginkan. QR lama otomatis tidak berlaku.
          </p>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmRotate}
        variant="warning"
        title="Ganti Kode QR Sesi Ini?"
        message={`QR lama yang sudah dibagikan/ditempel akan langsung tidak berlaku. Panitia perlu mencetak ulang QR untuk sesi ${formatWibDate(session.startAt)}.`}
        confirmLabel="Ya, Ganti QR"
        onConfirm={rotateQr}
        onClose={() => setConfirmRotate(false)}
      />
    </div>
  );
}
