export const ROOM_CATEGORIES = [
  "saran",
  "masukan",
  "kebutuhan",
  "pertanyaan",
  "ide",
  "cerita",
  "pengalaman",
] as const;
export const ROOM_STATUSES = [
  "new",
  "reviewing",
  "responded",
  "closed",
] as const;
export const ROOM_CATEGORY_LABELS: Record<string, string> = {
  saran: "Saran",
  masukan: "Masukan",
  kebutuhan: "Kebutuhan",
  pertanyaan: "Pertanyaan",
  ide: "Ide",
  cerita: "Cerita",
  pengalaman: "Pengalaman",
};
export const ROOM_STATUS_LABELS: Record<string, string> = {
  new: "Baru",
  reviewing: "Ditangani",
  responded: "Sudah ditanggapi",
  closed: "Selesai",
};
export const ROOM_OPEN_TASKS = ["pending", "in_progress", "waiting"];
export function containsContactDetail(value: string) {
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) return true;
  return (value.match(/\+?\d[\d\s().-]{7,}\d/g) || []).some((candidate) => {
    const digits = candidate.replace(/\D/g, "");
    return (
      digits.length >= 9 &&
      digits.length <= 15 &&
      (digits.startsWith("0") ||
        digits.startsWith("62") ||
        candidate.trimStart().startsWith("+"))
    );
  });
}
export function publicRoomTextSafe(
  title: string | null | undefined,
  text: string | null | undefined,
) {
  return (
    !!title &&
    title.trim().length >= 5 &&
    !!text &&
    text.trim().length >= 20 &&
    !containsContactDetail(title + " " + text)
  );
}
export const roomReference = (id: string) => id.slice(0, 8).toUpperCase();
