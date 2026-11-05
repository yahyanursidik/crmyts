/** Calendar dates are WIB dates. A monthly series repeats on the same nth weekday;
 * a fifth weekday is skipped in months which do not have it. Existing sessions never move. */
export function routineDateTime(date: string, time: string): Date | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return null;
  const value = new Date(`${date}T${time}:00+07:00`);
  return Number.isFinite(value.getTime()) &&
    new Date(+value + 25_200_000).toISOString().slice(0, 10) === date
    ? value
    : null;
}
export function routineScheduleError(
  startTime: string,
  endTime?: string | null,
  startDate?: string | null,
) {
  if (!routineDateTime(startDate || "2026-01-01", startTime))
    return "Tanggal atau jam mulai tidak valid.";
  if (
    endTime &&
    (!routineDateTime(startDate || "2026-01-01", endTime) ||
      endTime <= startTime)
  )
    return "Jam selesai harus setelah jam mulai pada hari yang sama.";
  return null;
}
export function addRoutineDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
export function planRoutineDates(
  config: {
    recurrence: string;
    dayOfWeek: number | null;
    startDate: string | null;
  },
  existing: string[],
  from: string,
  count: number,
) {
  const anchor = config.startDate || [...existing].sort()[0] || from;
  if (!routineDateTime(anchor, "00:00") || !routineDateTime(from, "00:00"))
    return [];
  const weekday =
    config.dayOfWeek ?? new Date(`${anchor}T00:00:00Z`).getUTCDay();
  const aligned = addRoutineDays(
    anchor,
    (weekday - new Date(`${anchor}T00:00:00Z`).getUTCDay() + 7) % 7,
  );
  const weekOfMonth = Math.ceil(Number(aligned.slice(8)) / 7);
  const dates: string[] = [];
  const used = new Set(existing);
  let cursor = from > aligned ? from : aligned;
  for (
    let i = 0;
    i < 1500 && dates.length < count;
    i++, cursor = addRoutineDays(cursor, 1)
  ) {
    if (
      new Date(`${cursor}T00:00:00Z`).getUTCDay() !== weekday ||
      used.has(cursor)
    )
      continue;
    const weeks = Math.round(
      (Date.parse(cursor) - Date.parse(aligned)) / 604_800_000,
    );
    const matches =
      config.recurrence === "monthly"
        ? Math.ceil(Number(cursor.slice(8)) / 7) === weekOfMonth
        : config.recurrence !== "biweekly" || weeks % 2 === 0;
    if (matches) dates.push(cursor);
  }
  return dates;
}
