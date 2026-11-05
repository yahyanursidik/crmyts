import { type ReactNode } from "react";
import { X } from "lucide-react";
import { useEventDialog } from "../events/components/useEventDialog";
import "./interactions.css";
export function InteractionDialog({
  open,
  title,
  onClose,
  busy = false,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useEventDialog(open, () => {
    if (!busy) onClose();
  });
  if (!open) return null;
  return (
    <div
      className="ix-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="ix-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        tabIndex={-1}
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="ix-icon-button"
            aria-label="Tutup dialog"
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
