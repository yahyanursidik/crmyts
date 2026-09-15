import { describe, expect, it } from 'vitest';
import { formatEventDateTimeWib, getEventEmailSettings } from '../../server/domain/events/emailNotifications';

describe('event email notifications', () => {
  it('formats event timestamps in WIB instead of the server UTC timezone', () => {
    expect(formatEventDateTimeWib('2026-09-19T01:00:00.000Z')).toContain('08.00');
    expect(formatEventDateTimeWib('2026-09-19T01:00:00.000Z')).toContain('WIB');
  });

  it('keeps ticket delivery enabled while reminder remains opt-in', () => {
    expect(getEventEmailSettings(undefined)).toEqual({
      registrationTicketEnabled: true,
      reminderEnabled: false,
      reminderHoursBefore: 24,
    });
  });

  it('limits the reminder lead time to a safe scheduling window', () => {
    expect(getEventEmailSettings({ emailNotifications: { reminderEnabled: true, reminderHoursBefore: 48 } }))
      .toMatchObject({ reminderEnabled: true, reminderHoursBefore: 48 });
    expect(getEventEmailSettings({ emailNotifications: { reminderHoursBefore: 900 } }).reminderHoursBefore).toBe(24);
  });
});
