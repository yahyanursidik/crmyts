import { isEventPast } from "@/lib/eventUtils";
export function toWibInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16);
}
export function fromWibInput(value: string): string {
  return new Date(value + ":00+07:00").toISOString();
}
export function registrationIsOpen(
  event: {
    isRegistrationOpen?: boolean;
    status?: string;
    startAt: string;
    endAt?: string | null;
  },
  now = Date.now(),
): boolean {
  return Boolean(event.isRegistrationOpen) && !isEventPast(event, now);
}
export function eventDateWib(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Jadwal belum tersedia"
    : date.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }) + " WIB";
}
export function diffEventConfig(
  current: Record<string, any> | null | undefined,
  next: Record<string, any>,
): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const [key, value] of Object.entries(next)) {
    if (
      key === "gateAccessToken" ||
      JSON.stringify(current?.[key]) === JSON.stringify(value)
    )
      continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = diffEventConfig(current?.[key], value);
      if (Object.keys(nested).length) patch[key] = nested;
    } else patch[key] = value;
  }
  return patch;
}
