import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Loader2 
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface DonationRecord {
  id: string;
  donationDate: string;
  amountRupiah: number;
  paymentMethod: string;
  externalReference?: string | null;
  verificationStatus: string;
  proofAttachmentId?: string | null;
  hasProof?: boolean;
  person?: { fullName: string; phoneE164?: string | null } | null;
  program?: { name: string } | null;
  creator?: { fullName: string } | null;
}

interface VerifyDonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  donation: DonationRecord | null;
}

export const VerifyDonationModal: React.FC<VerifyDonationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  donation,
}) => {
  const [mode, setMode] = useState<'review' | 'reject'>('review');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !donation) return null;

  const handleVerify = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await apiClient(`/donations/${donation.id}/verify`, { method: 'POST' });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal memverifikasi donasi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      setError('Alasan penolakan wajib diisi minimal 3 karakter');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await apiClient(`/donations/${donation.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menolak transaksi donasi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-surface-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
          <div>
            <h2 className="text-base font-bold text-surface-900 font-display flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-800" />
              Verifikasi Transaksi Keuangan
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Khusus Tim Finance Verifier (Segregation of Duties).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Transaction Summary Card */}
          <div className="p-4 rounded-lg bg-surface-50 border border-surface-200 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-surface-400 block">Nama Donatur</span>
                <p className="text-sm font-bold text-surface-900">{donation.person?.fullName || 'Anonim'}</p>
                <p className="text-[11px] text-surface-500">{donation.person?.phoneE164 || '-'}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-surface-400 block">Nominal Infaq</span>
                <p className="text-lg font-bold font-mono text-emerald-800">
                  Rp {donation.amountRupiah.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-200 text-xs">
              <div>
                <span className="text-[10px] text-surface-500 block">Program:</span>
                <span className="font-semibold text-surface-800">{donation.program?.name || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-surface-500 block">Metode Pembayaran:</span>
                <span className="font-semibold text-surface-800 capitalize">{donation.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[10px] text-surface-500 block">Tanggal Donasi:</span>
                <span className="font-semibold text-surface-800">
                  {new Date(donation.donationDate).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-surface-500 block">Referensi Bank:</span>
                <span className="font-mono font-semibold text-surface-800">{donation.externalReference || '-'}</span>
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          {mode === 'review' ? (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                Pastikan mutasi rekening koran bank yayasan telah sesuai dengan nominal dan nomor referensi di atas.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode('reject')}
                  className="btn-secondary text-red-700 hover:bg-red-50 border-red-200"
                >
                  <XCircle className="w-4 h-4 mr-1 text-red-600" /> Tolak Donasi
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={submitting}
                  className="btn-primary bg-emerald-800 hover:bg-emerald-900"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Sahkan Donasi (Verified)
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-red-700 mb-1">
                  Alasan Penolakan / Diskrepansi Transaksi <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Bukti transfer tidak tertera di mutasi rekening bank BSI pada tanggal tersebut..."
                  className="w-full px-3 py-2 border border-red-300 rounded-md text-xs focus:ring-2 focus:ring-red-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('review')}
                  className="btn-secondary"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary bg-red-700 hover:bg-red-800 text-white"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                  Konfirmasi Penolakan Donasi
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
