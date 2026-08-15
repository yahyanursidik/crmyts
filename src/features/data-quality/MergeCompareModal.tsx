import React, { useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { 
  GitMerge, 
  AlertTriangle, 
  X, 
  Check, 
  User, 
  ShieldAlert 
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
  const [reason, setReason] = useState<string>('Penggabungan data duplikat identik hasil review manual');
  const [phonePref, setPhonePref] = useState<'primary' | 'secondary'>('primary');
  const [emailPref, setEmailPref] = useState<'primary' | 'secondary'>('primary');
  const [cityPref, setCityPref] = useState<'primary' | 'secondary'>('primary');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAPrimary = primaryId === personA.id;
  const primaryPerson = isAPrimary ? personA : personB;
  const secondaryPerson = isAPrimary ? personB : personA;

  const handleMerge = async () => {
    if (!reason || reason.trim().length < 5) {
      setError('Alasan penggabungan wajib diisi minimal 5 karakter');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await apiClient('/data-quality/merge', {
        method: 'POST',
        body: JSON.stringify({
          primaryPersonId: primaryPerson.id,
          secondaryPersonId: secondaryPerson.id,
          reason: reason.trim(),
          fieldPreferences: {
            phoneE164: phonePref,
            email: emailPref,
            cityRegency: cityPref,
          },
        }),
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menggabungkan data jamaah');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-surface-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="p-5 bg-surface-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-800 text-brand-100">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display">
                Review & Penggabungan Data Jamaah (Merge)
              </h2>
              <p className="text-xs text-surface-300 mt-0.5">
                Pilih profil utama yang akan dipertahankan. Seluruh riwayat interaksi, tugas, infaq, dan wakaf akan dialihkan secara atomik.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {matchReason && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <span className="font-semibold">{matchReason}</span>
              </div>
              {similarityScore && (
                <span className="px-2 py-0.5 rounded-full font-bold bg-amber-200/60 text-amber-900">
                  {similarityScore}% Match
                </span>
              )}
            </div>
          )}

          {/* Side by Side Selection */}
          <div className="space-y-2">
            <label className="font-bold text-surface-900 uppercase tracking-wider text-[10px]">
              1. Pilih Master Target (Profil Yang Dipertahankan)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A */}
              <div
                onClick={() => setPrimaryId(personA.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isAPrimary
                    ? 'border-brand-800 bg-brand-50/20 shadow-xs'
                    : 'border-surface-200 bg-white hover:border-surface-300'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-surface-200">
                  <span className="font-bold text-surface-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-800" /> Profil A
                  </span>
                  {isAPrimary ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-900 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> Master Utama
                    </span>
                  ) : (
                    <span className="text-[10px] text-surface-400">Akan Di-merge</span>
                  )}
                </div>

                <div className="space-y-2 pt-3">
                  <div>
                    <span className="text-[10px] text-surface-400 block">Nama Lengkap</span>
                    <strong className="text-surface-900 font-medium text-sm">{personA.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-surface-400 block">Nomor Telepon</span>
                    <span className="font-mono text-surface-700">{personA.phoneE164 || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-surface-400 block">Email</span>
                    <span className="text-surface-700">{personA.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-surface-400 block">Domisili</span>
                    <span className="text-surface-700">{personA.cityRegency || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Option B */}
              <div
                onClick={() => setPrimaryId(personB.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  !isAPrimary
                    ? 'border-brand-800 bg-brand-50/20 shadow-xs'
                    : 'border-surface-200 bg-white hover:border-surface-300'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-surface-200">
                  <span className="font-bold text-surface-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-800" /> Profil B
                  </span>
                  {!isAPrimary ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-900 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> Master Utama
                    </span>
                  ) : (
                    <span className="text-[10px] text-surface-400">Akan Di-merge</span>
                  )}
                </div>

                <div className="space-y-2 pt-3">
                  <div>
                    <span className="text-[10px] text-surface-400 block">Nama Lengkap</span>
                    <strong className="text-surface-900 font-medium text-sm">{personB.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-surface-400 block">Nomor Telepon</span>
                    <span className="font-mono text-surface-700">{personB.phoneE164 || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-surface-400 block">Email</span>
                    <span className="text-surface-700">{personB.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-surface-400 block">Domisili</span>
                    <span className="text-surface-700">{personB.cityRegency || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Field Preference Overrides */}
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-3">
            <label className="font-bold text-surface-900 uppercase tracking-wider text-[10px] block">
              2. Preferensi Nilai Kolom Yang Dipertahankan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-surface-500 block mb-1">Pilihan Nomor HP:</span>
                <select
                  value={phonePref}
                  onChange={(e) => setPhonePref(e.target.value as any)}
                  className="input-field py-1 text-xs"
                >
                  <option value="primary">Gunakan Profil Utama ({primaryPerson.phoneE164 || 'Kosong'})</option>
                  <option value="secondary">Gunakan Profil Duplikat ({secondaryPerson.phoneE164 || 'Kosong'})</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-surface-500 block mb-1">Pilihan Email:</span>
                <select
                  value={emailPref}
                  onChange={(e) => setEmailPref(e.target.value as any)}
                  className="input-field py-1 text-xs"
                >
                  <option value="primary">Gunakan Profil Utama ({primaryPerson.email || 'Kosong'})</option>
                  <option value="secondary">Gunakan Profil Duplikat ({secondaryPerson.email || 'Kosong'})</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-surface-500 block mb-1">Pilihan Domisili:</span>
                <select
                  value={cityPref}
                  onChange={(e) => setCityPref(e.target.value as any)}
                  className="input-field py-1 text-xs"
                >
                  <option value="primary">Gunakan Profil Utama ({primaryPerson.cityRegency || 'Kosong'})</option>
                  <option value="secondary">Gunakan Profil Duplikat ({secondaryPerson.cityRegency || 'Kosong'})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mandatory Reason */}
          <div className="space-y-1.5">
            <label className="font-bold text-surface-900 flex items-center justify-between text-xs">
              <span>3. Alasan Penggabungan (Audit Trail Reason) *</span>
              <span className="text-[10px] text-surface-400">Min 5 karakter</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Duplikasi kontak sama hasil pendaftaran kajian offline dan online..."
              className="input-field py-2 text-xs"
            />
          </div>

          {/* Invariant Warning */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
            <strong>Catatan Tata Kelola Data:</strong> Operasi merge bersifat permanen dan dicatat dalam tabel audit log yayasan. Data sekunder ({secondaryPerson.fullName}) akan dinonaktifkan dan ditandai sebagai <em>MERGED</em>.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-50 border-t border-surface-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-2 px-4 text-xs"
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={submitting}
            className="btn-primary py-2 px-5 text-xs inline-flex items-center gap-1.5"
          >
            <GitMerge className="w-4 h-4" />
            {submitting ? 'Menggabungkan Data...' : `Gabungkan ke ${primaryPerson.fullName}`}
          </button>
        </div>
      </div>
    </div>
  );
};
