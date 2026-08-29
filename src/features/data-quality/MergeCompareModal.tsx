import React, { useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { 
  GitMerge, 
  AlertTriangle, 
  X, 
  Check, 
  IdCard,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
  Loader2,
} from 'lucide-react';

interface PersonBasic {
  id: string;
  fullName: string;
  phoneE164?: string | null;
  email?: string | null;
  cityRegency?: string | null;
  gender?: string | null;
  sourceCode?: string | null;
  engagementStatus?: string;
  createdAt?: string;
}

interface MergeCompareModalProps {
  personA: PersonBasic;
  personB: PersonBasic;
  similarityScore?: number;
  matchReason?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const MergeCompareModal: React.FC<MergeCompareModalProps> = ({
  personA,
  personB,
  similarityScore,
  matchReason,
  onClose,
  onSuccess,
}) => {
  // primaryPersonId will be the surviving master record
  const [primaryId, setPrimaryId] = useState<string>(personA.id);
  const [reason, setReason] = useState<string>('Penggabungan data duplikat identik hasil review manual Data Steward');
  const [phonePref, setPhonePref] = useState<'primary' | 'secondary'>('primary');
  const [emailPref, setEmailPref] = useState<'primary' | 'secondary'>('primary');
  const [cityPref, setCityPref] = useState<'primary' | 'secondary'>('primary');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAPrimary = primaryId === personA.id;
  const primaryPerson = isAPrimary ? personA : personB;
  const secondaryPerson = isAPrimary ? personB : personA;

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const fieldPreferences = {
        phoneE164: phonePref,
        email: emailPref,
        cityRegency: cityPref,
      };

      await apiClient('/data-quality/merge', {
        method: 'POST',
        body: JSON.stringify({
          primaryPersonId: primaryPerson.id,
          secondaryPersonId: secondaryPerson.id,
          reason: reason.trim(),
          fieldPreferences,
        }),
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menggabungkan data profil');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F3A2E]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FBF9F4] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#1B4332]/20 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/12">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#1C2321] font-display text-base">
                Review &amp; Merge Master Data Jamaah
              </h3>
              <p className="text-xs text-[#6B7A72]">
                Pilih profil yang akan dipertahankan sebagai Master Record utama. Seluruh riwayat infaq, kehadiran, dan tugas akan ditransfer secara atomik.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8A9690] hover:text-[#1C2321] hover:bg-[#F2EEE4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Comparison Notice */}
        {similarityScore !== undefined && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
            <span className="font-semibold">{matchReason || 'Kemiripan nama & data terdeteksi'}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#B58B3C] text-white font-bold text-[10px]">
              Skor: {similarityScore}% Mirip
            </span>
          </div>
        )}

        <form onSubmit={handleMergeSubmit} className="space-y-5">
          {/* 1. Side-by-side comparison */}
          <div>
            <label className="text-xs font-bold text-[#1C2321] block mb-2 font-display">
              1. Pilih Master Profil Utama (Data yang Tetap Aktif):
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Option A */}
              <div
                onClick={() => setPrimaryId(personA.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isAPrimary
                    ? 'border-[#1B4332] bg-white shadow-xs ring-1 ring-[#1B4332]/20'
                    : 'border-[#1B4332]/12 bg-[#F2EEE4]/50 hover:border-[#1B4332]/30'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#1B4332]/10">
                  <span className="font-bold text-[#1C2321] flex items-center gap-1.5 font-display">
                    <IdCard className="w-3.5 h-3.5 text-[#1B4332]" /> Kandidat A
                  </span>
                  {isAPrimary ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B4332] text-white flex items-center gap-1">
                      <Check className="w-3 h-3 text-[#E0B970]" /> Master Utama
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#6B7A72] font-medium">Akan Dinonaktifkan</span>
                  )}
                </div>

                <div className="space-y-2 pt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-[#6B7A72] block">Nama Lengkap</span>
                    <strong className="text-[#1C2321] font-display text-sm block">{personA.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6B7A72] block">Nomor Telepon</span>
                    <span className="font-mono text-[#14352A] font-semibold">{personA.phoneE164 || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6B7A72] block">Email</span>
                    <span className="text-[#3D4A44]">{personA.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6B7A72] block">Domisili</span>
                    <span className="text-[#3D4A44]">{personA.cityRegency || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Option B */}
              <div
                onClick={() => setPrimaryId(personB.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  !isAPrimary
                    ? 'border-[#1B4332] bg-white shadow-xs ring-1 ring-[#1B4332]/20'
                    : 'border-[#1B4332]/12 bg-[#F2EEE4]/50 hover:border-[#1B4332]/30'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#1B4332]/10">
                  <span className="font-bold text-[#1C2321] flex items-center gap-1.5 font-display">
                    <IdCard className="w-3.5 h-3.5 text-[#1B4332]" /> Kandidat B
                  </span>
                  {!isAPrimary ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B4332] text-white flex items-center gap-1">
                      <Check className="w-3 h-3 text-[#E0B970]" /> Master Utama
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#6B7A72] font-medium">Akan Dinonaktifkan</span>
                  )}
                </div>

                <div className="space-y-2 pt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-[#6B7A72] block">Nama Lengkap</span>
                    <strong className="text-[#1C2321] font-display text-sm block">{personB.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6B7A72] block">Nomor Telepon</span>
                    <span className="font-mono text-[#14352A] font-semibold">{personB.phoneE164 || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6B7A72] block">Email</span>
                    <span className="text-[#3D4A44]">{personB.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6B7A72] block">Domisili</span>
                    <span className="text-[#3D4A44]">{personB.cityRegency || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Resolusi Konflik Field Khusus */}
          <div className="p-4 bg-white rounded-xl border border-[#1B4332]/12 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#1C2321] block font-display">
                2. Resolusi Konflik Data Spesifik:
              </label>
              <span className="text-[10px] text-[#6B7A72] flex items-center gap-1">
                <HelpCircle className="w-3 h-3" /> Pilih data yang paling akurat
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Phone Conflict */}
              {personA.phoneE164 !== personB.phoneE164 && (
                <div className="flex items-center justify-between py-1.5 border-b border-[#1B4332]/8">
                  <span className="text-[#6B7A72] flex items-center gap-1 font-medium">
                    <Phone className="w-3 h-3 text-[#1B4332]" /> Nomor Telepon:
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="phonePref"
                        checked={phonePref === 'primary'}
                        onChange={() => setPhonePref('primary')}
                        className="text-[#1B4332] focus:ring-[#1B4332]"
                      />
                      <span className="font-mono text-[11px] text-[#1C2321]">{primaryPerson.phoneE164 || '(Kosong)'}</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="phonePref"
                        checked={phonePref === 'secondary'}
                        onChange={() => setPhonePref('secondary')}
                        className="text-[#1B4332] focus:ring-[#1B4332]"
                      />
                      <span className="font-mono text-[11px] text-[#1C2321]">{secondaryPerson.phoneE164 || '(Kosong)'}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Email Conflict */}
              {personA.email !== personB.email && (
                <div className="flex items-center justify-between py-1.5 border-b border-[#1B4332]/8">
                  <span className="text-[#6B7A72] flex items-center gap-1 font-medium">
                    <Mail className="w-3 h-3 text-[#1B4332]" /> Alamat Email:
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="emailPref"
                        checked={emailPref === 'primary'}
                        onChange={() => setEmailPref('primary')}
                        className="text-[#1B4332] focus:ring-[#1B4332]"
                      />
                      <span className="text-[11px] text-[#1C2321]">{primaryPerson.email || '(Kosong)'}</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="emailPref"
                        checked={emailPref === 'secondary'}
                        onChange={() => setEmailPref('secondary')}
                        className="text-[#1B4332] focus:ring-[#1B4332]"
                      />
                      <span className="text-[11px] text-[#1C2321]">{secondaryPerson.email || '(Kosong)'}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* City Conflict */}
              {personA.cityRegency !== personB.cityRegency && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[#6B7A72] flex items-center gap-1 font-medium">
                    <MapPin className="w-3 h-3 text-[#1B4332]" /> Domisili:
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="cityPref"
                        checked={cityPref === 'primary'}
                        onChange={() => setCityPref('primary')}
                        className="text-[#1B4332] focus:ring-[#1B4332]"
                      />
                      <span className="text-[11px] text-[#1C2321]">{primaryPerson.cityRegency || '(Kosong)'}</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="cityPref"
                        checked={cityPref === 'secondary'}
                        onChange={() => setCityPref('secondary')}
                        className="text-[#1B4332] focus:ring-[#1B4332]"
                      />
                      <span className="text-[11px] text-[#1C2321]">{secondaryPerson.cityRegency || '(Kosong)'}</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Alasan Penggabungan (Audit Trail) */}
          <div>
            <label className="text-xs font-bold text-[#1C2321] block mb-1 font-display">
              3. Alasan Penggabungan Master Data (Wajib Audit): *
            </label>
            <input
              type="text"
              required
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Duplikasi kontak jamaah terdaftar di dua kajian berbeda"
              className="w-full px-3 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl bg-white focus:ring-2 focus:ring-[#1B4332] outline-none text-[#1C2321]"
            />
            <p className="text-[10px] text-[#6B7A72] mt-1">
              Catatan ini akan tersimpan permanen di Log Audit Sistem beserta penanggung jawab PIC.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1B4332]/12">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-[#3D4A44] hover:bg-[#F2EEE4] rounded-xl transition-colors"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menggabungkan...</span>
                </>
              ) : (
                <>
                  <GitMerge className="w-3.5 h-3.5 text-[#E0B970]" />
                  <span>Gabungkan Master Data</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
