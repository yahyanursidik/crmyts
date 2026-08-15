import React, { useState, useEffect } from 'react';
import {
  X,
  Landmark,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Check,
} from 'lucide-react';

interface PendingDonation {
  id: string;
  donationDate: string;
  amountRupiah: number;
  paymentMethod: string;
  externalReference?: string | null;
  person?: {
    id: string;
    fullName: string;
    phoneE164?: string | null;
  } | null;
  program?: {
    name: string;
  } | null;
}

interface ParsedBankEntry {
  rawLine: string;
  date: string;
  description: string;
  amount: number;
  matchedDonation?: PendingDonation | null;
  matchScore?: number; // 0 to 100
}

interface BankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconciliationDone: () => void;
}

export const BankReconciliationModal: React.FC<BankReconciliationModalProps> = ({
  isOpen,
  onClose,
  onReconciliationDone,
}) => {
  const [inputText, setInputText] = useState('');
  const [pendingDonations, setPendingDonations] = useState<PendingDonation[]>([]);
  const [, setLoadingPending] = useState(true);
  const [parsedEntries, setParsedEntries] = useState<ParsedBankEntry[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifiedCount, setVerifiedCount] = useState<number | null>(null);

  // Load pending unverified donations
  const loadPending = async () => {
    try {
      setLoadingPending(true);
      const res = await fetch('/api/donations?verificationStatus=unverified&limit=100');
      if (res.ok) {
        const json = await res.json();
        setPendingDonations(json.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to load pending donations:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPending();
      setParsedEntries([]);
      setVerifiedCount(null);
      // Example default dummy text for quick testing
      setInputText(
        `15/08/2026\tTRSF E-BANKING CR AHMAD FAUZI\t500000\n15/08/2026\tQRIS YTS INFAQ DAKWAH SUNNAH\t100000\n15/08/2026\tBSI MOBILE TRANSFER INFAQ YTS\t250000`
      );
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Parser & Matching algorithm
  const handleParseAndMatch = () => {
    if (!inputText.trim()) return;

    const lines = inputText.split('\n').map((l) => l.trim()).filter(Boolean);
    const results: ParsedBankEntry[] = [];
    const usedDonationIds = new Set<string>();

    for (const line of lines) {
      // Try tab-separated, comma-separated, or regex
      const parts = line.includes('\t') ? line.split('\t') : line.split(/[,;|]/);
      const defaultDate = new Date().toISOString().split('T')[0] || '2026-08-15';
      let date = defaultDate;
      let desc = line;
      let amount = 0;

      if (parts.length >= 2) {
        // Extract amount from numbers
        for (const part of parts) {
          const cleanNum = part.replace(/[^0-9]/g, '');
          const num = parseInt(cleanNum, 10);
          if (!isNaN(num) && num > 1000) {
            amount = num;
          }
        }
        desc = parts.filter((p) => isNaN(parseInt(p.replace(/[^0-9]/g, ''), 10)) || p.length > 10).join(' ') || line;
      } else {
        // Single line fallback regex
        const numMatch = line.match(/(?:Rp\.?|CR|IDR)?\s*([0-9.,]{4,})/i);
        if (numMatch && numMatch[1]) {
          amount = parseInt(numMatch[1].replace(/[^0-9]/g, ''), 10) || 0;
        }
      }

      // Find match among pending donations
      let matched: PendingDonation | null = null;
      let score = 0;

      for (const d of pendingDonations) {
        if (usedDonationIds.has(d.id)) continue;

        if (d.amountRupiah === amount) {
          // Exact amount match
          score = 80;
          const donorName = d.person?.fullName?.toLowerCase() || '';
          if (donorName && desc.toLowerCase().includes(donorName)) {
            score = 100; // Perfect match
          }
          matched = d;
          usedDonationIds.add(d.id);
          break;
        }
      }

      results.push({
        rawLine: line,
        date,
        description: desc,
        amount,
        matchedDonation: matched,
        matchScore: score,
      });
    }

    setParsedEntries(results);
  };

  // Batch verify all matched entries
  const handleBatchVerify = async () => {
    const toVerify = parsedEntries.filter((e) => e.matchedDonation && e.matchedDonation.id);
    if (toVerify.length === 0) return;

    setVerifying(true);
    let count = 0;

    for (const item of toVerify) {
      try {
        const donationId = item.matchedDonation!.id;
        const res = await fetch(`/api/donations/${donationId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'verified',
            notes: `Auto-verified via BSI Bank Statement Reconciliation (${item.description})`,
          }),
        });
        if (res.ok) count++;
      } catch (err) {
        console.error('Batch verify error:', err);
      }
    }

    setVerifying(false);
    setVerifiedCount(count);
    onReconciliationDone();
  };

  const matchedCount = parsedEntries.filter((e) => e.matchedDonation).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#fbfaf6] rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-cream-300 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-white border-b border-cream-300 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-brand-50 border border-brand-200 text-brand-800">
              <Landmark className="w-6 h-6 text-brand-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-brand-950 font-display">
                  Rekonsiliasi Mutasi Bank BSI & Verifikasi Otomatis
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gold-400 text-gold-950">
                  BSI Net Banking
                </span>
              </div>
              <p className="text-xs text-surface-600 mt-0.5">
                Salin baris mutasi rekening BSI yayasan untuk mencocokkan donasi yang belum terverifikasi secara otomatis.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-surface-400 hover:text-surface-900 hover:bg-cream-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Alert */}
          {verifiedCount !== null && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <p className="font-bold text-xs">Alhamdulillah! Rekonsiliasi Selesai.</p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Berhasil memverifikasi <strong>{verifiedCount} transaksi donasi</strong> dan memperbarui status keuangan donatur.
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Input Mutasi */}
          <div className="bg-white p-5 rounded-2xl border border-cream-300 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-brand-950 uppercase tracking-wider block">
                1. Tempel (*Paste*) Teks Mutasi Rekening BSI / CSV
              </label>
              <span className="text-xs text-surface-500 font-medium">
                Pending di Sistem: <strong className="text-brand-900">{pendingDonations.length} transaksi</strong>
              </span>
            </div>

            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Contoh:&#10;15/08/2026  TRSF E-BANKING CR AHMAD FAUZI  500.000&#10;15/08/2026  QRIS YTS INFAQ DAKWAH  100.000"
              className="w-full p-3 font-mono text-xs border border-cream-300 rounded-xl bg-cream-50/60 focus:ring-2 focus:ring-brand-700"
            />

            <div className="flex justify-between items-center pt-1">
              <p className="text-[11px] text-surface-500">
                Format: <code>Tanggal [Tab/Koma] Deskripsi / Pengirim [Tab/Koma] Nominal</code>
              </p>
              <button
                type="button"
                onClick={handleParseAndMatch}
                className="py-2 px-4 bg-brand-800 hover:bg-brand-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-gold-300" />
                <span>Analisis & Cocokkan Transaksi</span>
              </button>
            </div>
          </div>

          {/* Step 2: Matched Results Table */}
          {parsedEntries.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-cream-300 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-brand-950 font-display">
                    2. Hasil Pencocokan Otomatis (*Matching Engine*)
                  </h3>
                  <p className="text-xs text-surface-500">
                    Ditemukan <strong className="text-emerald-700">{matchedCount} cocok</strong> dari {parsedEntries.length} baris mutasi bank.
                  </p>
                </div>

                {matchedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleBatchVerify}
                    disabled={verifying}
                    className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Memproses Verifikasi...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>⚡ Verifikasi Massal ({matchedCount} Transaksi)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-cream-300">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-cream-100 text-[11px] font-extrabold text-brand-950 uppercase tracking-wider border-b border-cream-300">
                      <th className="py-2.5 px-3">Mutasi Bank BSI</th>
                      <th className="py-2.5 px-3 text-right">Nominal Masuk</th>
                      <th className="py-2.5 px-4">Pencocokan Transaksi CRM</th>
                      <th className="py-2.5 px-3 text-center">Tingkat Kecocokan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200 font-medium text-surface-800">
                    {parsedEntries.map((entry, idx) => {
                      const matched = entry.matchedDonation;

                      return (
                        <tr key={idx} className={matched ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-cream-50'}>
                          <td className="py-3 px-3">
                            <p className="font-mono text-xs font-bold text-brand-950">{entry.description}</p>
                            <span className="text-[10px] text-surface-500">{entry.rawLine}</span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-brand-900">
                            Rp {entry.amount.toLocaleString('id-ID')}
                          </td>

                          <td className="py-3 px-4">
                            {matched ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>{matched.person?.fullName || 'Muhsinin Anonim'}</span>
                                </p>
                                <p className="text-[10px] text-emerald-800">
                                  Program: {matched.program?.name || 'Infaq Umum'} • Ref: {matched.externalReference || '-'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-surface-400 italic">
                                Belum ada formulir donasi pending dengan nominal ini
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {matched ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                {entry.matchScore}% Cocok
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cream-200 text-surface-500">
                                Tidak Cocok
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-cream-300 flex items-center justify-between text-xs text-surface-600">
          <span>
            Verifikasi aman oleh <strong>Finance Verifier</strong> terikat Segregation of Duties.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold rounded-xl bg-cream-100 hover:bg-cream-200 text-brand-950 border border-cream-300"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
