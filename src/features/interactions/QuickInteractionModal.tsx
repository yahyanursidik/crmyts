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
  { value: 'in_person', label: 'Tatap Muka Markaz', icon: MapPin },
  { value: 'telegram', label: 'Telegram', icon: Send },
  { value: 'email', label: 'Email Resmi', icon: Mail },
  { value: 'other', label: 'Lainnya', icon: Clock },
];

const OUTCOME_OPTIONS = [
  { value: 'sudah_dihubungi', label: 'Sudah Dihubungi', color: 'bg-[#2F7D4F]/10 text-[#2F7D4F] border-[#2F7D4F]/25' },
  { value: 'tidak_merespons', label: 'Tidak Merespons', color: 'bg-[#F2EEE4] text-[#6B7A72] border-[#1B4332]/12' },
  { value: 'minta_dihubungi_kembali', label: 'Minta Dihubungi Kembali', color: 'bg-[#0F4C4A]/10 text-[#0F4C4A] border-[#0F4C4A]/25' },
  { value: 'berminat', label: 'Berminat', color: 'bg-[#2F7D4F]/15 text-[#2F7D4F] border-[#2F7D4F]/30 font-bold' },
  { value: 'belum_berminat', label: 'Belum Berminat', color: 'bg-[#C77A16]/10 text-[#C77A16] border-[#C77A16]/25' },
  { value: 'selesai', label: 'Selesai', color: 'bg-[#1B4332]/10 text-[#14352A] border-[#1B4332]/25' },
  { value: 'perlu_eskalasi', label: 'Perlu Eskalasi', color: 'bg-rose-50 text-rose-800 border-rose-200 font-bold' },
];

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'JM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'JM';
  if (parts.length === 1) return (parts[0] || 'JM').substring(0, 2).toUpperCase();
  const first = parts[0] || 'J';
  const last = parts[parts.length - 1] || 'M';
  return ((first[0] || 'J') + (last[0] || 'M')).toUpperCase();
}

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
        setPersonCandidates(res.data || []);
      } catch (err) {
        console.error('Search person error:', err);
      } finally {
        setSearchingPersons(false);
      }
    }, 350);

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

  const selectedInitials = getInitials(selectedPersonName);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold font-display text-[#1C2321]">
                Catat Sapaan &amp; Komunikasi Jamaah
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
                ⚡ Cepat (60 Detik)
              </span>
            </div>
            <p className="text-xs text-[#6B7A72] mt-0.5">
              Dokumentasikan komunikasi untuk menjaga amanah silaturahmi &amp; follow-up.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1C2321] hover:bg-[#1B4332]/8 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
              {error}
            </div>
          )}

          {/* 1. Person Autocomplete / Display */}
          <div>
            <label className="block text-xs font-semibold text-[#1C2321] mb-1">
              Nama Jamaah <span className="text-rose-600">*</span>
            </label>
            {selectedPersonId ? (
              <div className="flex items-center justify-between p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#1B4332] text-white font-mono font-bold text-xs flex items-center justify-center">
                    {selectedInitials}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1C2321]">{selectedPersonName}</p>
                    <p className="text-[10px] text-[#2F7D4F] font-semibold">Jamaah Terpilih</p>
                  </div>
                </div>
                {!initialPersonId && (
                  <button
                    type="button"
                    onClick={() => { setSelectedPersonId(''); setSelectedPersonName(''); }}
                    className="text-xs text-[#6B7A72] hover:text-rose-700 font-semibold underline"
                  >
                    Ganti
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 text-[#8A9690] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  placeholder="Ketik nama jamaah atau nomor WA untuk mencari..."
                  className="w-full pl-9 pr-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
                  autoFocus
                />
                {searchingPersons && (
                  <Loader2 className="w-3.5 h-3.5 text-[#8A9690] animate-spin absolute right-3 top-3" />
                )}

                {personCandidates.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-[#1B4332]/8">
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
                        className="w-full px-3 py-2 text-left hover:bg-[#F2EEE4] flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <p className="font-bold text-[#1C2321]">{c.fullName}</p>
                          <p className="text-[10px] font-mono text-[#6B7A72]">{c.phoneE164 || 'Tanpa nomor telepon'}</p>
                        </div>
                        <span className="text-[9.5px] font-mono font-semibold bg-[#1B4332]/10 text-[#14352A] px-2 py-0.5 rounded capitalize">
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
            <label className="block text-xs font-semibold text-[#1C2321] mb-1.5">Saluran Komunikasi</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNEL_OPTIONS.map((ch) => {
                const Icon = ch.icon;
                const isSelected = channel === ch.value;
                return (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => setChannel(ch.value)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-2xs font-bold'
                        : 'bg-[#F2EEE4] text-[#3D4A44] border-[#1B4332]/10 hover:border-[#1B4332]/25'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Outcome Quick Buttons */}
          <div>
            <label className="block text-xs font-semibold text-[#1C2321] mb-1.5">
              Hasil / Respon Jamaah (Outcome) <span className="text-rose-600">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OUTCOME_OPTIONS.map((opt) => {
                const isSelected = outcome === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOutcome(opt.value)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs transition-all ${opt.color} ${
                      isSelected ? 'ring-2 ring-[#1B4332] shadow-2xs font-bold scale-[1.02]' : 'opacity-70 hover:opacity-100'
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
            <label className="block text-xs font-semibold text-[#1C2321] mb-1">
              Topik &amp; Ringkasan Percakapan <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Contoh: Mengingatkan jadwal kajian subuh & menyampaikan program wakaf..."
              className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
            />
          </div>

          {/* 5. Next Action & Atomic Task Creation */}
          <div className="p-3.5 bg-[#F2EEE4] border border-[#1B4332]/12 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#14352A]">
                Langkah Lanjutan (Next Action)
              </label>
              <span className="text-[10px] text-[#6B7A72]">Otomatis buat task tindak lanjut</span>
            </div>

            <input
              type="text"
              value={nextAction}
              onChange={(e) => {
                setNextAction(e.target.value);
                if (e.target.value && !createTask) setCreateTask(true);
              }}
              placeholder="Contoh: Kirimkan proposal rincian wakaf masjid via WhatsApp"
              className="w-full px-3 py-1.5 border border-[#1B4332]/14 rounded-lg text-xs focus:ring-2 focus:ring-[#1B4332] outline-none bg-white text-[#1C2321]"
            />

            {nextAction.trim() && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#3D4A44] mb-0.5">
                    Batas Waktu (Due Date)
                  </label>
                  <input
                    type="date"
                    value={taskDueAt}
                    onChange={(e) => setTaskDueAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 rounded text-xs focus:ring-2 focus:ring-[#1B4332] outline-none bg-white text-[#1C2321]"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-[#3D4A44] mb-0.5">Prioritas Task</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 rounded text-xs focus:ring-2 focus:ring-[#1B4332] outline-none bg-white text-[#1C2321] font-semibold"
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
            <label className="font-semibold text-[#3D4A44] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#6B7A72]" />
              Sensitivitas Data:
            </label>
            <select
              value={sensitivityLevel}
              onChange={(e) => setSensitivityLevel(e.target.value)}
              className="px-2.5 py-1 border border-[#1B4332]/14 rounded-lg text-xs focus:ring-2 focus:ring-[#1B4332] outline-none bg-[#F2EEE4] text-[#1C2321] font-semibold"
            >
              <option value="standard">Standar (Akses Reguler)</option>
              <option value="confidential">Konfidensial (Audit Log Aktif)</option>
              <option value="restricted">Restriksi Khusus Pimpinan</option>
            </select>
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl text-xs font-semibold border border-[#1B4332]/12"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              <span>Simpan Sapaan (Simpan Interaksi)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
