/** Calendar boundaries for YTS reporting, independent of the hosting time zone. */
export function jakartaCalendarWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  const year = value('year'), month = value('month') - 1, day = value('day');
  const offset = 7 * 60 * 60 * 1000;
  return {
    monthStart: new Date(Date.UTC(year, month, 1) - offset),
    monthEnd: new Date(Date.UTC(year, month + 1, 1) - offset - 1),
    dayStart: new Date(Date.UTC(year, month, day) - offset),
    dayEnd: new Date(Date.UTC(year, month, day + 1) - offset - 1),
  };
}
