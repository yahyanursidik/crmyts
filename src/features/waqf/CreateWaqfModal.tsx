import React, { useState, useEffect } from 'react';
import { 
  X, 
  Landmark, 
  Search, 
  Loader2, 
  FileText 
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface CreateWaqfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const WAQF_TYPE_OPTIONS = [
  { value: 'tanah', label: 'Wakaf Tanah / Lahan Dakwah' },
  { value: 'bangunan', label: 'Wakaf Gedung / Bangunan Markaz' },
  { value: 'uang', label: 'Wakaf Uang / Dana Abadi' },
  { value: 'kendaraan', label: 'Wakaf Kendaraan Operasional Dakwah' },
  { value: 'logistik_dakwah', label: 'Wakaf Peralatan / Logistik Kajian' },
  { value: 'sarana_air', label: 'Wakaf Sumur Bor & Sarana Air Bersih' },
  { value: 'lainnya', label: 'Wakaf Aset Lainnya' },
];

export const CreateWaqfModal: React.FC<CreateWaqfModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedPersonName, setSelectedPersonName] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [personCandidates, setPersonCandidates] = useState<any[]>([]);
  const [searchingPersons, setSearchingPersons] = useState(false);

  const [waqfType, setWaqfType] = useState('tanah');
  const [estimatedValueRupiah, setEstimatedValueRupiah] = useState('');
  const [notesSummary, setNotesSummary] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedPersonId('');
      setSelectedPersonName('');
      setPersonSearch('');
      setPersonCandidates([]);
      setWaqfType('tanah');
      setEstimatedValueRupiah('');
      setNotesSummary('');
      setError(null);
    }
  }, [isOpen]);

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
      setError('Silakan pilih nama wakif (calon wakif)');
      return;
    }

    const cleanValue = estimatedValueRupiah ? parseInt(estimatedValueRupiah.replace(/[^0-9]/g, ''), 10) : null;

    try {
      setSubmitting(true);
      setError(null);

      await apiClient('/waqf', {
        method: 'POST',
        body: JSON.stringify({
          personId: selectedPersonId,
          waqfType,
          estimatedValueRupiah: cleanValue,
          notesSummary: notesSummary.trim() || null,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menginisiasi kasus wakaf');
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
              <Landmark className="w-4 h-4 text-purple-700" />
              Inisiasi Kasus Amanah Wakaf Baru
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Tahap awal: <strong className="text-purple-800 font-semibold">Interested (Peminat Wakaf)</strong>.
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
              Nama Wakif / Calon Wakif <span className="text-red-500">*</span>
            </label>
            {selectedPersonId ? (
              <div className="flex items-center justify-between p-2.5 bg-purple-50/70 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-800 text-white font-bold text-xs flex items-center justify-center">
                    {selectedPersonName.charAt(0) || 'W'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-surface-900">{selectedPersonName}</p>
                    <p className="text-[10px] text-purple-800">Wakif Terpilih (Auto-assign role wakif)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedPersonId(''); setSelectedPersonName(''); }}
                  className="text-xs text-surface-500 hover:text-red-600 font-medium underline"
                >
                  Ganti
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 text-surface-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  placeholder="Ketik nama jamaah / calon wakif..."
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
                          <p className="text-[10px] text-surface-500">{c.phoneE164 || 'Tanpa nomor telepon'}</p>
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

          {/* 2. Jenis Wakaf & Estimasi Nilai */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Kategori Aset Wakaf <span className="text-red-500">*</span>
              </label>
              <select
                value={waqfType}
                onChange={(e) => setWaqfType(e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
              >
                {WAQF_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">
                Estimasi Nilai Aset (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-surface-500">Rp</span>
                <input
                  type="text"
                  value={estimatedValueRupiah}
                  onChange={(e) => setEstimatedValueRupiah(formatAmountInput(e.target.value))}
                  placeholder="2.500.000.000"
                  className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs font-mono font-bold text-surface-900 focus:ring-2 focus:ring-brand-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Catatan & Spesifikasi Aset */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Catatan Lokasi / Spesifikasi Aset Wakaf
            </label>
            <div className="relative">
              <FileText className="w-3.5 h-3.5 text-surface-400 absolute left-3 top-2.5" />
              <textarea
                rows={3}
                value={notesSummary}
                onChange={(e) => setNotesSummary(e.target.value)}
                placeholder="Contoh: Tanah seluas 1.200 m2 di Kec. Cileunyi, peruntukan pembangunan Markaz Tahfidz Quran..."
                className="w-full pl-9 pr-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800">
            Sistem secara otomatis menginisialisasi 4 checklist berkas standar (*KTP Wakif, Bukti Hak Milik, Draf AIW, Berita Acara Nazhir*).
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
              Inisiasi Kasus Wakaf
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
