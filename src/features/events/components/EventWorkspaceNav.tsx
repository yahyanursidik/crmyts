import { Users, Settings2, QrCode, Store } from "lucide-react";
export type EventPanel = "participants" | "settings" | "scanner" | "bazaar";
export function EventWorkspaceNav({
  active,
  onChange,
}: {
  active: EventPanel;
  onChange: (panel: EventPanel) => void;
}) {
  return (
    <nav className="event-context-nav" aria-label="Menu event">
      {(
        [
          ["participants", "Peserta", Users],
          ["settings", "Pengaturan", Settings2],
          ["scanner", "Scanner", QrCode],
          ["bazaar", "Bazar", Store],
        ] as const
      ).map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          aria-current={active === key ? "page" : undefined}
          onClick={() => onChange(key)}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
