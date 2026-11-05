import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function PeopleDialog({
  open,
  title,
  onClose,
  busy = false,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden';
    (
      ref.current?.querySelector<HTMLElement>('[data-autofocus]') ||
      ref.current?.querySelector<HTMLElement>(
        'input:not([type=checkbox]),textarea,button',
      )
    )?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = ref.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary',
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflowY = overflow;
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="people-dialog-backdrop">
      <div
        ref={ref}
        className={`people-dialog${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        aria-busy={busy}
      >
        <header>
          <h2 id={id}>{title}</h2>
          <button
            className="people-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup dialog"
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
