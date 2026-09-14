/**
 * Mengecek apakah suatu kajian sudah berlalu (selesai / lewat).
 * Kajian dianggap telah berlalu jika:
 * 1. Status event adalah 'completed' atau 'cancelled'
 * 2. Waktu selesai (endAt) sudah lewat (< now)
 * 3. Jika endAt tidak diisi, waktu mulai (startAt) + 2 jam sudah lewat (< now)
 */
export function isEventPast(
  event?: {
    startAt: string | Date;
    endAt?: string | Date | null;
    status?: string | null;
  } | null,
  nowTimestamp: number = Date.now()
): boolean {
  if (!event || !event.startAt) return false;
  if (event.status === 'completed' || event.status === 'cancelled') {
    return true;
  }
  if (event.endAt) {
    const endTime = new Date(event.endAt).getTime();
    return !isNaN(endTime) && endTime < nowTimestamp;
  }
  const startTime = new Date(event.startAt).getTime();
  if (isNaN(startTime)) return false;
  // Default durasi majelis ilmu adalah 2 jam bila endAt tidak ditentukan
  return startTime + 2 * 60 * 60 * 1000 < nowTimestamp;
}
