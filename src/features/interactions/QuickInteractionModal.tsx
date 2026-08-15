import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquare, 
  Phone, 
  Mail, 
  MapPin, 
  Send, 
  Clock, 
  Search, 
  Loader2, 
  ShieldAlert 
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface QuickInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPersonId?: string;
  initialPersonName?: string;
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'phone_call', label: 'Panggilan Telepon', icon: Phone },
  { value: 'in_person', label: 'Tatap Muka di Markaz', icon: MapPin },
  { value: 'telegram', label: 'Telegram', icon: Send },
  { value: 'email', label: 'Email Resmi', icon: Mail },
  { value: 'other', label: 'Lainnya', icon: Clock },
];

const OUTCOME_OPTIONS = [
  { value: 'sudah_dihubungi', label: 'Sudah Dihubungi', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  { value: 'tidak_merespons', label: 'Tidak Merespons', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { value: 'minta_dihubungi_kembali', label: 'Minta Dihubungi Kembali', color: 'bg-blue-50 text-blue-800 border-blue-300' },
  { value: 'berminat', label: 'Berminat', color: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold' },
  { value: 'belum_berminat', label: 'Belum Berminat', color: 'bg-amber-50 text-amber-800 border-amber-300' },
  { value: 'selesai', label: 'Selesai', color: 'bg-brand-50 text-brand-900 border-brand-300' },
  { value: 'perlu_eskalasi', label: 'Perlu Eskalasi', color: 'bg-red-50 text-red-800 border-red-300 font-bold' },
];

export const QuickInteractionModal: React.FC<QuickInteractionModalProps> = ({
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

  const [channel, setChannel] = useState('whatsapp');
  const [outcome, setOutcome] = useState('sudah_dihubungi');
  const [summary, setSummary] = useState('');
  const [sensitivityLevel, setSensitivityLevel] = useState('standard');
  const [nextAction, setNextAction] = useState('');
  const [createTask, setCreateTask] = useState(false);
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPersonId) {
      setSelectedPersonId(initialPersonId);
      setSelectedPersonName(initialPersonName || '');
    } else {
      setSelectedPersonId('');
      setSelectedPersonName('');
    }
    setSummary('');
    setNextAction('');
    setCreateTask(false);
    setTaskDueAt('');
    setChannel('whatsapp');
    setOutcome('sudah_dihubungi');
    setSensitivityLevel('standard');
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
      setError('Silakan pilih jamaah yang disapa');
      return;
    }
    if (!summary.trim()) {
      setError('Ringkasan interaksi wajib diisi');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await apiClient('/interactions', {
        method: 'POST',
        body: JSON.stringify({
          personId: selectedPersonId,
          channel,
          summary: summary.trim(),
          outcome,
          sensitivityLevel,
          nextAction: nextAction.trim() || null,
          taskDueAt: createTask && taskDueAt ? new Date(taskDueAt).toISOString() : (nextAction ? new Date(Date.now() + 86400000 * 2).toISOString() : null),
          taskPriority,
        }),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal mencatat interaksi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-surface-200 w-full max-w-xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header with Speed Badge */}
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-surface-900 font-display">
                Catat Sapaan & Komunikasi Jamaah
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-900 border border-brand-200">
                ⚡ Cepat (60 Detik)
              </span>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Dokumentasikan komunikasi untuk menjaga amanah silaturahmi & follow-up.
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

          {/* 1. Person Autocomplete / Display */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Nama Jamaah <span className="text-red-500">*</span>
            </label>
            {selectedPersonId ? (
              <div className="flex items-center justify-between p-2.5 bg-brand-50/70 border border-brand-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-brand-800 text-white font-bold text-xs flex items-center justify-center">
                    {selectedPersonName.charAt(0) || 'J'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-surface-900">{selectedPersonName}</p>
                    <p className="text-[10px] text-brand-800">Jamaah Terpilih</p>
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
                  placeholder="Ketik nama jamaah atau nomor WA untuk mencari..."
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

          {/* 2. Channel Selection Pills */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1.5">Saluran Komunikasi</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNEL_OPTIONS.map((ch) => {
                const Icon = ch.icon;
                const isSelected = channel === ch.value;
                return (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => setChannel(ch.value)}
                    className={`flex items-center gap-2 p-2 rounded-md border text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-brand-900 text-white border-brand-900 shadow-sm font-semibold'
                        : 'bg-white text-surface-700 border-surface-200 hover:border-surface-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Outcome Quick Buttons (7 options) */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1.5">
              Hasil / Respon Jamaah (Outcome) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OUTCOME_OPTIONS.map((opt) => {
                const isSelected = outcome === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOutcome(opt.value)}
                    className={`px-2.5 py-1.5 rounded-md border text-xs transition-all ${opt.color} ${
                      isSelected ? 'ring-2 ring-brand-800 shadow-2xs font-bold scale-[1.02]' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Summary */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Topik & Ringkasan Percakapan <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Contoh: Mengingatkan jadwal kajian subuh & menyampaikan program wakaf..."
              className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          {/* 5. Next Action & Atomic Task Creation */}
          <div className="p-3.5 bg-surface-50 border border-surface-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-surface-800">
                Langkah Lanjutan (Next Action)
              </label>
              <span className="text-[10px] text-surface-500">Otomatis buat task tindak lanjut</span>
            </div>

            <input
              type="text"
              value={nextAction}
              onChange={(e) => {
                setNextAction(e.target.value);
                if (e.target.value && !createTask) setCreateTask(true);
              }}
              placeholder="Contoh: Kirimkan proposal rincian wakaf masjid via WhatsApp"
              className="w-full px-3 py-1.5 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
            />

            {nextAction.trim() && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-surface-700 mb-0.5">
                    Batas Waktu (Due Date)
                  </label>
                  <input
                    type="date"
                    value={taskDueAt}
                    onChange={(e) => setTaskDueAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-surface-300 rounded text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-surface-700 mb-0.5">Prioritas Task</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-surface-300 rounded text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
                  >
                    <option value="low">Rendah (Low)</option>
                    <option value="medium">Sedang (Medium)</option>
                    <option value="high">Tinggi (High)</option>
                    <option value="urgent">Mendesak (Urgent)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 6. Sensitivity & Governance */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="font-semibold text-surface-700 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-surface-500" />
              Sensitivitas Data:
            </label>
            <select
              value={sensitivityLevel}
              onChange={(e) => setSensitivityLevel(e.target.value)}
              className="px-2.5 py-1 border border-surface-300 rounded text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
            >
              <option value="standard">Standar (Akses Reguler)</option>
              <option value="confidential">Konfidensial (Audit Log Aktif)</option>
              <option value="restricted">Restriksi Khusus Pimpinan</option>
            </select>
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
              Simpan Sapaan (Simpan Interaksi)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
