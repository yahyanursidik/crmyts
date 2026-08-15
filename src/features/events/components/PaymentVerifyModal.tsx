import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { formatPhoneDisplay, getWhatsAppLink } from '@/lib/phone';

export interface ParticipantPaymentData {
  id: string;
  personId: string;
  personName: string;
  personPhone: string;
  ticketCode?: string | null;
  paymentStatus: string; // 'free' | 'pending_payment' | 'waiting_verification' | 'verified' | 'rejected'
  paymentProofUrl?: string | null;
  paymentAmountRupiah?: number | null;
  paymentVerifiedAt?: string | null;
  paymentRejectionReason?: string | null;
  eventTitle: string;
  eventPriceRupiah?: number | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  registrationGroupId?: string | null;
  familyRelationship?: string | null;
  age?: number | null;
  groupMembersCount?: number;
}

interface PaymentVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventId: string;
  participant: ParticipantPaymentData | null;
}

export const PaymentVerifyModal: React.FC<PaymentVerifyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  eventId,
  participant,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'reject'>('view');
  const [rejectionReason, setRejectionReason] = useState('');

  if (!isOpen || !participant) return null;

  const handleVerify = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await apiClient(`/events/${eventId}/attendances/${participant.id}/verify-payment`, {
        method: 'POST',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal memverifikasi bukti pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setError('Alasan penolakan bukti transfer wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await apiClient(`/events/${eventId}/attendances/${participant.id}/reject-payment`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menolak bukti pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  const waLink = getWhatsAppLink(
    participant.personPhone,
    `Assalamu'alaikum Warahmatullahi Wabarakatuh, ${participant.personName}. Terkait pendaftaran kajian ${participant.eventTitle} (Tiket: ${participant.ticketCode || '-'})...`
  );

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-surface-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#fbfaf6] rounded-3xl max-w-lg w-full shadow-2xl border border-cream-300 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cream-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-brand-950 font-display">
                Verifikasi Pembayaran Daurah/Kajian
              </h2>
              <p className="text-[11px] text-surface-500 truncate max-w-[280px]">
                {participant.eventTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-surface-400 hover:text-surface-700 hover:bg-cream-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {participant.registrationGroupId && (
            <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-950 block">
                  Pendaftaran Rombongan Keluarga ({participant.groupMembersCount || 1} Jamaah)
                </span>
                <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                  Grup: {participant.registrationGroupId}
                </span>
              </div>
              <p className="text-[11px] text-teal-800 leading-tight">
                Hubungan: <b>{participant.familyRelationship || 'Anggota Rombongan'}</b> {participant.age ? `(${participant.age} thn)` : ''}. Menyetujui pembayaran ini akan otomatis mengesahkan tiket seluruh {participant.groupMembersCount || 1} anggota rombongan.
              </p>
            </div>
          )}

          {/* Participant Info Card */}
          <div className="p-4 bg-white rounded-2xl border border-cream-300/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                Pendaftar
              </span>
              <span className="font-mono text-[11px] font-bold text-brand-900 bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-200">
                {participant.ticketCode || 'TIKET-TERBIT'}
              </span>
            </div>

            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-brand-950 font-display">
                  {participant.personName}
                </p>
                <p className="text-surface-600 font-mono text-[11px] mt-0.5">
                  {formatPhoneDisplay(participant.personPhone)}
                </p>
              </div>

              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl border border-emerald-200 text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat WA</span>
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cream-100 text-[11px]">
              <div>
                <span className="text-surface-400 block text-[10px]">Nominal Biaya:</span>
                <span className="font-black text-brand-900 font-mono text-xs">
                  Rp {(participant.paymentAmountRupiah || participant.eventPriceRupiah || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-surface-400 block text-[10px]">Status Saat Ini:</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    participant.paymentStatus === 'verified'
                      ? 'bg-emerald-100 text-emerald-800'
                      : participant.paymentStatus === 'waiting_verification'
                      ? 'bg-amber-100 text-amber-800'
                      : participant.paymentStatus === 'rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {participant.paymentStatus === 'verified'
                    ? 'Lunas'
                    : participant.paymentStatus === 'waiting_verification'
                    ? 'Menunggu Verifikasi'
                    : participant.paymentStatus === 'rejected'
                    ? 'Ditolak'
                    : 'Belum Bayar'}
                </span>
              </div>
            </div>

            {participant.paymentRejectionReason && (
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px]">
                <span className="font-bold block">Alasan Penolakan Sebelumnya:</span>
                {participant.paymentRejectionReason}
              </div>
            )}
          </div>

          {/* Proof Image Viewer */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-brand-950 block">
              Bukti Transfer / Struk Pembayaran
            </span>

            {participant.paymentProofUrl ? (
              <div className="p-2 bg-white rounded-2xl border border-cream-300 shadow-2xs flex flex-col items-center gap-2">
                <div className="max-h-64 w-full rounded-xl overflow-hidden bg-cream-50 flex items-center justify-center border border-cream-200">
                  <img
                    src={participant.paymentProofUrl}
                    alt="Bukti Transfer"
                    className="max-h-64 object-contain w-auto mx-auto rounded-lg shadow-2xs"
                  />
                </div>
                <a
                  href={participant.paymentProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-brand-800 hover:text-brand-950 hover:underline flex items-center gap-1 py-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Gambar Ukuran Penuh</span>
                </a>
              </div>
            ) : (
              <div className="p-6 text-center bg-cream-50 rounded-2xl border border-dashed border-cream-300 text-surface-400 space-y-1">
                <Receipt className="w-8 h-8 mx-auto text-surface-300" />
                <p className="font-bold text-surface-600">Belum ada bukti pembayaran</p>
                <p className="text-[11px]">Peserta belum mengunggah foto struk transfer.</p>
              </div>
            )}
          </div>

          {/* Rejection Form Mode */}
          {mode === 'reject' && (
            <form onSubmit={handleReject} className="space-y-3 bg-white p-4 rounded-2xl border border-rose-200">
              <span className="text-xs font-bold text-rose-900 block">
                Tulis Alasan Penolakan Bukti Pembayaran
              </span>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Nominal transfer kurang dari Rp 50.000, atau mutasi bank belum masuk."
                rows={3}
                required
                className="w-full p-2.5 border border-rose-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  disabled={submitting}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Kirim Penolakan</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {mode === 'view' && (
          <div className="px-6 py-4 bg-white border-t border-cream-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-cream-300 bg-white hover:bg-cream-100 text-surface-700 text-xs font-bold transition-all shadow-2xs"
            >
              Tutup
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('reject')}
                disabled={submitting}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Tolak Pembayaran</span>
              </button>

              <button
                type="button"
                onClick={handleVerify}
                disabled={submitting}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>✓ Setujui & Verifikasi</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
