import { useEffect, useState } from 'react';
import { LoaderCircle, QrCode } from 'lucide-react';
import { toDataURL } from 'qrcode';

interface ParticipantQrCodeProps {
  value: string;
  ticketCode: string;
  className?: string;
}

/** QR dibuat di browser; payload-nya hanya tautan tiket, tidak memuat biodata jamaah. */
export function ParticipantQrCode({ value, ticketCode, className = '' }: ParticipantQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setFailed(false);

    toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#1c321d', light: '#ffffff' },
    })
      .then((result) => active && setDataUrl(result))
      .catch(() => active && setFailed(true));

    return () => {
      active = false;
    };
  }, [value]);

  return (
    <figure className={`rounded-2xl border border-brand-200 bg-white p-3 text-center shadow-sm ${className}`}>
      {dataUrl ? (
        <img
          src={dataUrl}
          width={160}
          height={160}
          alt={`QR tiket ${ticketCode}`}
          className="mx-auto h-40 w-40 rounded-lg bg-white"
        />
      ) : failed ? (
        <div className="mx-auto flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-lg bg-rose-50 text-rose-800">
          <QrCode className="h-7 w-7" />
          <span className="px-3 text-xs font-semibold">QR belum dapat dibuat. Gunakan kode peserta.</span>
        </div>
      ) : (
        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-lg bg-cream-100 text-brand-800">
          <LoaderCircle className="h-7 w-7 animate-spin" aria-label="Membuat QR tiket" />
        </div>
      )}
      <figcaption className="mt-2 text-[11px] leading-relaxed text-surface-600">
        Tunjukkan QR ini atau sebutkan nomor tiket <strong className="inline-block font-mono font-black text-brand-950 bg-cream-200/80 px-2 py-0.5 rounded border border-cream-400 text-xs">{ticketCode}</strong> kepada panitia gerbang.
      </figcaption>
    </figure>
  );
}
