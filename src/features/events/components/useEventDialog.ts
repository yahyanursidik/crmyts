import { useEffect, useRef } from "react";
let openDialogs: HTMLElement[] = [];
let originalOverflow = "";
export function useEventDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const node = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    if (!openDialogs.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs.push(node);
    const focusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ).filter((item) => item.getClientRects().length > 0);
    node.focus();
    const keydown = (event: KeyboardEvent) => {
      if (openDialogs.at(-1) !== node) return;
      // Child confirmations and editors keep control of Escape/Tab.
      const nested = node.querySelector('[role="dialog"]');
      if (nested) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          node.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === node)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      openDialogs = openDialogs.filter((item) => item !== node);
      if (!openDialogs.length) document.body.style.overflow = originalOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
