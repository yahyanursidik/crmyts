import type { ReactNode } from "react";
import { useEventDialog } from "../events/components/useEventDialog";
export function BazaarSubDialog({
  children,
  onClose,
  label,
  busy = false,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  busy?: boolean;
  className?: string;
}) {
  const ref = useEventDialog(true, () => {
    if (!busy) onClose();
  });
  return (
    <div
      className="bz-subdialog"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      ref={ref}
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      {children}
    </div>
  );
}
