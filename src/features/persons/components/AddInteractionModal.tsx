import { useEffect, useId, useState } from 'react';
import { usePermissions } from '@refinedev/core';
import { Check, Loader2 } from 'lucide-react';
import {
  PERMISSIONS,
  type PermissionCode,
} from '@server/permissions/constants';
import { apiClient } from '@/lib/apiClient';
import { PeopleDialog } from './PeopleDialog';
import { CHANNEL_LABELS } from '../model';
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  personId: string;
  personName: string;
}
export function AddInteractionModal({
  isOpen,
  onClose,
  onSuccess,
  personId,
  personName,
}: Props) {
  const id = useId();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const [form, setForm] = useState({
    channel: 'whatsapp',
    summary: '',
    outcome: '',
    sensitivityLevel: 'standard',
    nextAction: '',
    taskDueAt: '',
    taskPriority: 'medium',
  });
  const [createTask, setCreateTask] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isOpen) {
      setForm({
        channel: 'whatsapp',
        summary: '',
        outcome: '',
        sensitivityLevel: 'standard',
        nextAction: '',
        taskDueAt: '',
        taskPriority: 'medium',
      });
      setCreateTask(false);
      setError('');
    }
  }, [isOpen, personId]);
  const set = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createTask && (!form.nextAction.trim() || !form.taskDueAt)) {
      setError('Isi tindak lanjut dan tanggal tugas.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiClient(`/persons/${personId}/interactions`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          summary: form.summary.trim(),
          outcome: form.outcome || null,
          nextAction: form.nextAction.trim() || null,
          createFollowUpTask: createTask,
          taskDueAt: createTask ? new Date(form.taskDueAt).toISOString() : null,
        }),
      });
      onSuccess();
      onClose();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const select = (
    key: keyof typeof form,
    label: string,
    items: Record<string, string>,
  ) => (
    <div className="people-field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <select
        id={`${id}-${key}`}
        value={form[key]}
        onChange={(event) => set(key, event.target.value)}
        disabled={busy}
      >
        {Object.entries(items).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <PeopleDialog
      open={isOpen}
      title="Catat interaksi"
      onClose={onClose}
      busy={busy}
      wide
    >
      <form onSubmit={submit}>
        <div className="people-form-body">
          <p className="people-eyebrow">{personName}</p>
          {error && (
            <div className="people-notice is-error" role="alert">
              {error}
            </div>
          )}
          <div className="people-form-grid">
            {select('channel', 'Kanal', CHANNEL_LABELS)}
            {select('sensitivityLevel', 'Akses catatan', {
              standard: 'Standar',
              confidential: 'Konfidensial',
              restricted: 'Terbatas',
            })}
            <div className="people-field span-all">
              <label htmlFor={`${id}-summary`}>Ringkasan *</label>
              <textarea
                id={`${id}-summary`}
                data-autofocus
                rows={3}
                value={form.summary}
                onChange={(event) => set('summary', event.target.value)}
                minLength={3}
                maxLength={4000}
                required
                disabled={busy}
              />
            </div>
            {select('outcome', 'Hasil', {
              '': 'Belum ditentukan',
              sudah_dihubungi: 'Sudah dihubungi',
              tidak_merespons: 'Belum merespons',
              minta_dihubungi_kembali: 'Hubungi kembali',
              berminat: 'Berminat',
              belum_berminat: 'Belum berminat',
              selesai: 'Selesai',
              perlu_eskalasi: 'Perlu eskalasi',
            })}
          </div>
          {permissions.includes(PERMISSIONS.TASKS_CREATE) && (
            <div className="people-form-details">
              <label className="people-inline-link">
                <input
                  type="checkbox"
                  checked={createTask}
                  onChange={(event) => setCreateTask(event.target.checked)}
                  disabled={busy}
                />
                Buat tugas tindak lanjut
              </label>
              {createTask && (
                <div className="people-form-grid mt-4">
                  <div className="people-field span-all">
                    <label htmlFor={`${id}-next`}>Tindak lanjut *</label>
                    <input
                      id={`${id}-next`}
                      value={form.nextAction}
                      onChange={(event) =>
                        set('nextAction', event.target.value)
                      }
                      required
                      disabled={busy}
                    />
                  </div>
                  <div className="people-field">
                    <label htmlFor={`${id}-due`}>Jatuh tempo *</label>
                    <input
                      id={`${id}-due`}
                      type="datetime-local"
                      value={form.taskDueAt}
                      onChange={(event) => set('taskDueAt', event.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  {select('taskPriority', 'Prioritas', {
                    low: 'Rendah',
                    medium: 'Sedang',
                    high: 'Tinggi',
                    urgent: 'Mendesak',
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="people-form-footer">
          <button
            type="button"
            className="people-button"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </button>
          <button className="people-button is-primary" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            {busy ? 'Menyimpan…' : 'Simpan interaksi'}
          </button>
        </footer>
      </form>
    </PeopleDialog>
  );
}
