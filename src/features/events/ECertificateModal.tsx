import React from 'react';
import { X, Printer, Award } from 'lucide-react';
import { BrandEmblem } from '@/components/common/BrandLogo';

interface ECertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendeeName: string;
  eventTitle: string;
  speaker: string;
  dateStr: string;
  ticketCode: string;
}

export const ECertificateModal: React.FC<ECertificateModalProps> = ({
  isOpen,
  onClose,
  attendeeName,
  eventTitle,
  speaker,
  dateStr,
  ticketCode,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-cream-300 overflow-hidden my-auto">
        {/* Modal Top Bar */}
        <div className="p-4 bg-cream-100 border-b border-cream-300 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-gold-600" />
            <span className="text-sm font-extrabold text-brand-950 font-display">
              E-Sertifikat Resmi Keikutsertaan Majelis Ilmu
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-brand-800 hover:bg-brand-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-surface-400 hover:text-surface-900 hover:bg-cream-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Printable Canvas */}
        <div className="p-8 sm:p-12 bg-[#FBFAF6] text-surface-900 relative print:p-0">
          {/* Certificate Ornamental Border */}
          <div className="border-4 border-[#365E38] p-6 sm:p-10 rounded-2xl relative bg-white shadow-sm">
            {/* Corner Gold Rosettes */}
            <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-gold-500" />
            <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-gold-500" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-gold-500" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-gold-500" />

            {/* Header Emblem */}
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <BrandEmblem useImage={true} className="w-16 h-16 shadow-xs rounded-2xl" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-gold-600 font-display">
                Yayasan Tarbiyah Sunnah
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1C321D] tracking-tight font-display uppercase">
                Sertifikat Keikutsertaan
              </h1>
              <p className="text-[11px] font-mono text-surface-400">
                No. Reg: CERT-YTS-{ticketCode || '2026-001'}
              </p>
            </div>

            {/* Body */}
            <div className="text-center my-8 space-y-4">
              <p className="text-xs sm:text-sm text-surface-600 font-serif italic">
                Dengan memohon ridha Allah ﷻ, sertifikat ini diberikan sebagai bukti kehadiran kepada:
              </p>

              <div className="py-2 border-b-2 border-gold-400/60 inline-block px-8">
                <h2 className="text-2xl sm:text-3xl font-black text-[#1C321D] font-display">
                  {attendeeName}
                </h2>
              </div>

              <p className="text-xs sm:text-sm text-surface-600 max-w-xl mx-auto leading-relaxed pt-2">
                Atas partisipasi dan kehadirannya dalam majelis ilmu / daurah syar'iyyah:
              </p>

              <h3 className="text-lg sm:text-xl font-black text-brand-900 font-display max-w-2xl mx-auto px-4">
                "{eventTitle}"
              </h3>

              <p className="text-xs text-surface-500">
                Bersama Pemateri: <strong className="text-brand-950 font-bold">{speaker}</strong>
              </p>
            </div>

            {/* Footer Signature Strip */}
            <div className="grid grid-cols-2 pt-8 mt-6 border-t border-cream-300 text-center text-xs">
              <div className="space-y-1">
                <p className="text-[11px] text-surface-400">Tempat & Tanggal Terbit:</p>
                <p className="font-bold text-brand-950">Bandung, {formattedDate}</p>
                <div className="h-12 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-surface-400 border border-cream-300 px-2 py-0.5 rounded">
                    Tersertifikasi Digital
                  </span>
                </div>
                <p className="font-bold text-surface-700">Panitia Daurah & Majelis</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-surface-400">Mengetahui,</p>
                <p className="font-bold text-brand-950">Yayasan Tarbiyah Sunnah</p>
                <div className="h-12 flex items-center justify-center">
                  <span className="px-3 py-1 bg-brand-50 border border-brand-300 text-brand-900 rounded-full font-black text-[10px] uppercase tracking-wider">
                    ✓ Sah & Terverifikasi
                  </span>
                </div>
                <p className="font-bold text-surface-700">Divisi Dakwah & Pendidikan</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
