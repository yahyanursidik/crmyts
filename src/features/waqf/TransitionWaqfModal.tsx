import React, { useState } from 'react';
import { 
  X, 
  ArrowRight, 
  CheckSquare, 
  Calendar, 
  Loader2, 
  ShieldCheck 
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

export const WAQF_STAGE_DETAILS: Record<string, { label: string; description: string; color: string }> = {
  interested: { label: 'Interested', description: 'Peminat Wakaf Awal', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  consulted: { label: 'Consulted', description: 'Konsultasi Syariah & Kelayakan', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  pledged: { label: 'Pledged', description: 'Komitmen Ikrar Wakif', color: 'bg-purple-50 text-purple-800 border-purple-200' },
  document_preparation: { label: 'Document Preparation', description: 'Pemberkasan & Draf AIW', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  in_progress: { label: 'In Progress', description: 'Proses Legalitas BPN/KUA/Notaris', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  completed: { label: 'Completed', description: 'Sah Terbit Akta Ikrar Wakaf', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  stewardship: { label: 'Stewardship', description: 'Pemeliharaan & Pelaporan Manfaat', color: 'bg-brand-50 text-brand-900 border-brand-200' },
};

const STAGE_KEYS = [
  'interested',
  'consulted',
  'pledged',
  'document_preparation',
  'in_progress',
  'completed',
  'stewardship',
];

interface WaqfCaseRecord {
  id: string;
  waqfType: string;
  estimatedValueRupiah?: number | null;
  currentStage: string;
  person?: { fullName: string } | null;
  checklistItems: Array<{
    id: string;
    itemCode: string;
    label: string;
    isRequired: boolean;
    isCompleted: boolean;
  }>;
}

interface TransitionWaqfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  waqfCase: WaqfCaseRecord | null;
}

export const TransitionWaqfModal: React.FC<TransitionWaqfModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  waqfCase,
}) => {
  const [toStage, setToStage] = useState('interested');
  const [reason, setReason] = useState('');
  const [checklist, setChecklist] = useState<Array<{ id: string; label: string; isCompleted: boolean }>>([]);
  const [nextAction, setNextAction] = useState('');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (waqfCase) {
      // Default to next stage
      const currentIdx = STAGE_KEYS.indexOf(waqfCase.currentStage);
      const nextStageKey = (currentIdx >= 0 && currentIdx < STAGE_KEYS.length - 1 ? STAGE_KEYS[currentIdx + 1] : waqfCase.currentStage) || 'interested';
      setToStage(nextStageKey);
      setReason('');
      setNextAction('');
      setTaskDueAt('');
      setChecklist(waqfCase.checklistItems.map((c) => ({ id: c.id, label: c.label, isCompleted: c.isCompleted })));
      setError(null);
    }
  }, [waqfCase, isOpen]);

  if (!isOpen || !waqfCase) return null;

  const handleToggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isCompleted: !item.isCompleted } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toStage) {
      setError('Silakan pilih tahapan tujuan');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Alasan transisi tahapan wajib diisi minimal 3 karakter');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await apiClient(`/waqf/${waqfCase.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStage,
          reason: reason.trim(),
          checklistUpdates: checklist.map((c) => ({ itemId: c.id, isCompleted: c.isCompleted })),
          nextAction: nextAction.trim() || null,
          taskDueAt: taskDueAt ? new Date(taskDueAt).toISOString() : (nextAction ? new Date(Date.now() + 86400000 * 3).toISOString() : null),
          taskPriority,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal memproses transisi tahapan wakaf');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStageInfo = WAQF_STAGE_DETAILS[waqfCase.currentStage] || { label: waqfCase.currentStage, description: '', color: '' };
  const targetStageInfo = WAQF_STAGE_DETAILS[toStage] || { label: toStage, description: '', color: '' };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-surface-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
          <div>
            <h2 className="text-base font-bold text-surface-900 font-display flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-800" />
              Transisi Tahapan Amanah Wakaf
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Wakif: <strong className="text-surface-800">{waqfCase.person?.fullName || 'Wakif'}</strong> • Jenis: <span className="capitalize">{waqfCase.waqfType}</span>
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

          {/* Stage Progression Banner */}
          <div className="p-3 bg-surface-50 border border-surface-200 rounded-lg flex items-center justify-between">
            <div className="text-center">
              <span className="text-[10px] text-surface-400 font-semibold block uppercase">Tahap Saat Ini</span>
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-surface-200 text-surface-800 mt-1">
                {currentStageInfo.label}
              </span>
            </div>
            <ArrowRight className="w-5 h-5 text-brand-700 shrink-0" />
            <div className="text-center">
              <span className="text-[10px] text-brand-800 font-semibold block uppercase">Tahap Tujuan</span>
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-brand-100 text-brand-900 mt-1">
                {targetStageInfo.label}
              </span>
            </div>
          </div>

          {/* Target Stage Selector */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Pilih Tahapan Baru <span className="text-red-500">*</span>
            </label>
            <select
              value={toStage}
              onChange={(e) => setToStage(e.target.value)}
              className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white font-semibold"
            >
              {STAGE_KEYS.map((key) => {
                const info = WAQF_STAGE_DETAILS[key] || { label: key, description: '', color: '' };
                return (
                  <option key={key} value={key}>
                    {info.label} ({info.description})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Checklist Berkas */}
          {checklist.length > 0 && (
            <div className="p-3 bg-surface-50 border border-surface-200 rounded-lg space-y-2">
              <label className="text-xs font-bold text-surface-800 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-brand-700" />
                Checklist Kelengkapan Dokumen & Legalitas
              </label>
              <div className="space-y-1.5 pt-1">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 text-xs text-surface-700 cursor-pointer hover:text-surface-900"
                  >
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={() => handleToggleChecklist(item.id)}
                      className="rounded text-brand-800 focus:ring-brand-700 w-4 h-4"
                    />
                    <span className={item.isCompleted ? 'line-through text-surface-400' : ''}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Catatan & Alasan Progres Transisi <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Berkas AIW telah ditandatangani di hadapan Pejabat Pembuat Akta Ikrar Wakaf (PPAIW) KUA..."
              className="w-full px-3 py-2 border border-surface-300 rounded-md text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          {/* Optional Next Task */}
          <div className="p-3 bg-surface-50 border border-surface-200 rounded-lg space-y-2">
            <label className="text-xs font-bold text-surface-800 block">
              Langkah Tindak Lanjut (Optional Task)
            </label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Contoh: Koordinasi pengukuran tanah dengan Kantor Pertanahan BPN"
              className="w-full px-3 py-1.5 border border-surface-300 rounded text-xs focus:ring-2 focus:ring-brand-700 focus:outline-none bg-white"
            />
            {nextAction.trim() && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-surface-600 mb-0.5">Jatuh Tempo</label>
                  <div className="relative">
                    <Calendar className="w-3 h-3 text-surface-400 absolute left-2 top-2" />
                    <input
                      type="date"
                      value={taskDueAt}
                      onChange={(e) => setTaskDueAt(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 border border-surface-300 rounded text-xs bg-white focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-surface-600 mb-0.5">Prioritas</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-2 py-1 border border-surface-300 rounded text-xs bg-white focus:outline-none"
                  >
                    <option value="low">Rendah</option>
                    <option value="medium">Sedang</option>
                    <option value="high">Tinggi</option>
                    <option value="urgent">Mendesak</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
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
              Konfirmasi Pindah Tahapan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
