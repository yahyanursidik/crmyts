import { useEffect, useId, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { PeopleDialog } from './PeopleDialog';
export function SensitiveNoteModal({
  open,
  personId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  personId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [level, setLevel] = useState('high');
  const [expiry, setExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setText('');
      setReason('');
      setExpiry('');
      setLevel('high');
      setError('');
    }
  }, [open, personId]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiClient(`/persons/${personId}/sensitive-notes`, {
        method: 'POST',
        body: JSON.stringify({
          noteText: text.trim(),
          reason: reason.trim(),
          sensitivityLevel: level,
          expiresAt: expiry ? new Date(expiry).toISOString() : null,
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
  return (
    <PeopleDialog
      open={open}
      title="Catatan khusus"
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <div className="people-form-body">
          {error && (
            <div className="people-notice is-error" role="alert">
              {error}
            </div>
          )}
          <div className="people-form-grid">
            <div className="people-field span-all">
              <label htmlFor={`${id}-text`}>Catatan *</label>
              <textarea
                id={`${id}-text`}
                data-autofocus
                rows={4}
                minLength={3}
                maxLength={4000}
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={busy}
                required
              />
            </div>
            <div className="people-field span-all">
              <label htmlFor={`${id}-reason`}>Alasan pencatatan *</label>
              <input
                id={`${id}-reason`}
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                required
              />
            </div>
            <div className="people-field">
              <label htmlFor={`${id}-level`}>Tingkat akses</label>
              <select
                id={`${id}-level`}
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                disabled={busy}
              >
                <option value="high">Khusus</option>
                <option value="restricted">Terbatas</option>
              </select>
            </div>
            <div className="people-field">
              <label htmlFor={`${id}-expiry`}>Berlaku sampai</label>
              <input
                id={`${id}-expiry`}
                type="datetime-local"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <p className="people-form-hint">
            Hanya staf dengan izin catatan khusus yang dapat membacanya.
          </p>
        </div>
        <footer className="people-form-footer">
          <button
            className="people-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </button>
          <button className="people-button is-primary" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />}Simpan
            catatan
          </button>
        </footer>
      </form>
    </PeopleDialog>
  );
}
