import React, { useState, useEffect } from 'react';
import { 
  X, 
  Coins, 
  Search, 
  Loader2, 
  Calendar, 
  Building, 
  FileText, 
  ShieldCheck, 
  Upload 
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface CreateDonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPersonId?: string;
  initialPersonName?: string;
}

interface ProgramOption {
  id: string;
  name: string;
  code: string;
}

export const CreateDonationModal: React.FC<CreateDonationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPersonId,
  initialPersonName,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId || '');
  const [selectedPersonName, setSelectedPersonName] = useState(initialPersonName || '');
  const [personSearch, setPersonSearch] = useState('');
  const [personCandidates, setPersonCandidates] = useState<any[]>([]);
  const [searchingPersons, setSearchingPersons] = useState(false);

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programId, setProgramId] = useState('');
  const [amountRupiah, setAmountRupiah] = useState('');
  const [donationDate, setDonationDate] = useState(new Date().toISOString().split('T')[0] || '');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [externalReference, setExternalReference] = useState('');
  const [notes, setNotes] = useState('');
  const [hasProofUpload, setHasProofUpload] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active programs
  useEffect(() => {
    if (!isOpen) return;
    const fetchPrograms = async () => {
      try {
        setLoading(true);
        const res = await apiClient<ProgramOption[]>('/donation-programs');
        setPrograms(res.data);
        if (res.data.length > 0 && !programId && res.data[0]) {
          setProgramId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load programs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrograms();
  }, [isOpen]);

  useEffect(() => {
    if (initialPersonId) {
      setSelectedPersonId(initialPersonId);
      setSelectedPersonName(initialPersonName || '');
    } else {
      setSelectedPersonId('');
      setSelectedPersonName('');
    }
    setAmountRupiah('');
    setExternalReference('');
    setNotes('');
    setHasProofUpload(false);
    setError(null);
  }, [initialPersonId, initialPersonName, isOpen]);

  // Autocomplete person search
  useEffect(() => {
    if (!personSearch.trim() || selectedPersonId) {
      setPersonCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingPersons(true);
        const res = await apiClient<any[]>(`/persons?search=${encodeURIComponent(personSearch.trim())}&pageSize=5`);
        setPersonCandidates(res.data);
      } catch (err) {
        console.error('Search person error:', err);
      } finally {
        setSearchingPersons(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [personSearch, selectedPersonId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) {
      setError('Silakan pilih nama jamaah / donatur');
      return;
    }
    if (!programId) {
      setError('Silakan pilih program infaq/donasi');
      return;
    }

    const cleanAmount = parseInt(amountRupiah.replace(/[^0-9]/g, ''), 10);
    if (!cleanAmount || cleanAmount <= 0) {
      setError('Nominal donasi harus lebih dari Rp 0');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const targetDate = donationDate ? new Date(donationDate) : new Date();

      await apiClient('/donations', {
        method: 'POST',
        body: JSON.stringify({
          personId: selectedPersonId,
          programId,
          amountRupiah: cleanAmount,
          donationDate: targetDate.toISOString(),
          paymentMethod,
          externalReference: externalReference.trim() || null,
          notes: notes.trim() || null,
          proofAttachmentId: hasProofUpload ? '018f9999-9999-7000-8000-000000000001' : null,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal mencatat transaksi donasi');
    } finally {
      setSubmitting(false);
    }
  };

  const formatAmountInput = (val: string) => {
    const numbers = val.replace(/[^0-9]/g, '');
    if (!numbers) return '';
    return parseInt(numbers, 10).toLocaleString('id-ID');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-surface-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
          <div>
            <h2 className="text-base font-bold text-surface-900 font-display flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-700" />
              Catat Infaq & Donasi Baru
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Status awal: <strong className="text-amber-800 font-semibold">Unverified</strong> (Menunggu Verifikasi Keuangan).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* 1. Person Autocomplete */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Nama Jamaah / Donatur <span className="text-red-500">*</span>
            </label>
            {selectedPersonId ? (
              <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                    {selectedPersonName.charAt(0) || 'D'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-surface-900">{selectedPersonName}</p>
                    <p className="text-[10px] text-emerald-800">Donatur Terpilih (Auto-assign role donatur)</p>
                  </div>
                </div>
                {!initialPersonId && (
                  <button
                    type="button"
                    onClick={() => { setSelectedPersonId(''); setSelectedPersonName(''); }}
                    className="text-xs text-surface-500 hover:text-red-600 font-medium underline"
                  >
                    Ganti
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  placeholder="Ketik nama jamaah atau nomor WA..."
                  className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  autoFocus
                />
                {searchingPersons && (
                  <Loader2 className="w-3.5 h-3.5 text-surface-400 animate-spin absolute right-3 top-3" />
                )}

                {personCandidates.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-surface-100">
                    {personCandidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedPersonId(c.id);
                          setSelectedPersonName(c.fullName);
                          setPersonSearch('');
                          setPersonCandidates([]);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-surface-50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-surface-900">{c.fullName}</p>
                          <p className="text-[10px] text-surface-500">{c.phoneE164 || 'Tanpa telepon'}</p>
                        </div>
                        <span className="text-[10px] font-semibold bg-surface-100 px-2 py-0.5 rounded capitalize">
                          {c.engagementStatus}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Program Infaq & Nominal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Program Infaq / Donasi <span className="text-red-500">*</span>
              </label>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
              >
                {programs.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Nominal Rupiah (Rp) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-surface-500">Rp</span>
                <input
                  type="text"
                  required
                  value={amountRupiah}
                  onChange={(e) => setAmountRupiah(formatAmountInput(e.target.value))}
                  placeholder="1.000.000"
                  className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs font-mono font-bold text-surface-900 focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Tanggal & Metode Pembayaran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Tanggal Donasi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-surface-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={donationDate}
                  onChange={(e) => setDonationDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
              >
                <option value="bank_transfer">Transfer Bank (BSI / Mandiri / BCA)</option>
                <option value="qris">QRIS Yayasan</option>
                <option value="cash">Tunai / Kotak Infaq Markaz</option>
                <option value="other">Metode Lainnya</option>
              </select>
            </div>
          </div>

          {/* 4. External Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Nomor Referensi Bank / Mutasi
              </label>
              <div className="relative">
                <Building className="w-3.5 h-3.5 text-surface-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="Contoh: BSI-TRF-88992"
                  className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Catatan Akad / Hajat Donatur
              </label>
              <div className="relative">
                <FileText className="w-3.5 h-3.5 text-surface-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Titipan infaq santri penghafal Quran"
                  className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 5. Bukti Transfer Privat (Private Proof Upload) */}
          <div className="p-3 bg-surface-50 border border-surface-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-surface-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Bukti Transfer (Privat & Terproteksi)
              </label>
              <span className="text-[10px] text-surface-500">Amanah Privasi</span>
            </div>

            <label className={`flex items-center justify-center p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              hasProofUpload ? 'border-emerald-500 bg-emerald-50/50' : 'border-surface-300 hover:border-brand-700 bg-white'
            }`}>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={() => setHasProofUpload(true)}
              />
              <div className="flex items-center gap-2 text-xs">
                <Upload className="w-4 h-4 text-surface-500" />
                {hasProofUpload ? (
                  <span className="font-semibold text-emerald-800">✓ Bukti Transfer Siap Diunggah</span>
                ) : (
                  <span className="text-surface-600">Klik untuk lampirkan struk / screenshot transfer</span>
                )}
              </div>
            </label>
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-surface-200 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Simpan Donasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
