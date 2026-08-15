import React, { useState } from 'react';
import { X, MessageSquare, Loader2, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface AddInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  personId: string;
  personName: string;
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp Chat' },
  { value: 'phone_call', label: 'Panggilan Telepon' },
  { value: 'in_person', label: 'Tatap Muka di Kajian / Markaz' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email Resmi' },
  { value: 'other', label: 'Lainnya' },
];

export const AddInteractionModal: React.FC<AddInteractionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  personId,
  personName,
}) => {
  const [channel, setChannel] = useState('whatsapp');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [sensitivityLevel, setSensitivityLevel] = useState('standard');
  const [nextAction, setNextAction] = useState('');
  const [createFollowUpTask, setCreateFollowUpTask] = useState(false);
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Ringkasan interaksi wajib diisi');
      return;
    }

    if (createFollowUpTask && !taskDueAt) {
      setError('Tanggal jatuh tempo tugas tindak lanjut wajib ditentukan');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await apiClient(`/persons/${personId}/interactions`, {
        method: 'POST',
        body: JSON.stringify({
          channel,
          summary: summary.trim(),
          outcome: outcome.trim() || null,
          sensitivityLevel,
          nextAction: nextAction.trim() || null,
          createFollowUpTask,
          taskDueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
          taskPriority,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan catatan interaksi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-surface-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
          <div>
            <h2 className="text-base font-bold text-surface-900 font-display flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-700" />
              Catat Sapaan & Interaksi
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Jamaah: <strong className="text-surface-700">{personName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">Saluran Komunikasi</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
              >
                {CHANNEL_OPTIONS.map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1">Tingkat Akses</label>
              <select
                value={sensitivityLevel}
                onChange={(e) => setSensitivityLevel(e.target.value)}
                className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
              >
                <option value="standard">Standar (Semua Staf)</option>
                <option value="confidential">Konfidensial</option>
                <option value="restricted">Restriksi Khusus</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Topik & Ringkasan Komunikasi <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Contoh: Menanyakan kabar dan konfirmasi kehadiran di Kajian Akbar Ahad pagi..."
              className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">Hasil Komunikasi / Respon Jamaah</label>
            <input
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Contoh: InsyaAllah hadir bersama keluarga"
              className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">Langkah Lanjutan (Next Action)</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Contoh: Kirimkan broadcast pengingat H-1 kajian"
              className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          {/* Follow-up task toggle */}
          <div className="pt-2 border-t border-surface-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-surface-800 cursor-pointer">
              <input
                type="checkbox"
                checked={createFollowUpTask}
                onChange={(e) => setCreateFollowUpTask(e.target.checked)}
                className="rounded text-brand-800 focus:ring-brand-700 w-4 h-4"
              />
              <span>Buat Otomatis Tugas Tindak Lanjut (Follow-Up Task)</span>
            </label>

            {createFollowUpTask && (
              <div className="mt-3 p-3 bg-surface-50 border border-surface-200 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-surface-700 mb-1">
                      Batas Waktu (Due Date) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-2.5" />
                      <input
                        type="date"
                        required={createFollowUpTask}
                        value={taskDueAt}
                        onChange={(e) => setTaskDueAt(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 border border-surface-300 rounded text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-surface-700 mb-1">Prioritas</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="w-full px-2 py-1.5 border border-surface-300 rounded text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-medium"
                    >
                      <option value="low">Rendah (Low)</option>
                      <option value="medium">Sedang (Medium)</option>
                      <option value="high">Tinggi (High)</option>
                      <option value="urgent">Mendesak (Urgent)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-surface-200 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Simpan Interaksi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
