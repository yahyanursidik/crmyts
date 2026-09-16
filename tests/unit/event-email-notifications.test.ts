import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatEventDateTimeWib, getEventEmailSettings, sendEventTicketEmail } from '../../server/domain/events/emailNotifications';
import { listEventBroadcastSummaries } from '../../server/domain/events/reminderDispatch';
import { resetServerEnvCache } from '../../server/config/env';

describe('event email notifications', () => {
  beforeEach(() => {
    vi.stubEnv('MAILKETING_API_TOKEN', 'test-mailketing-token');
    resetServerEnvCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetServerEnvCache();
  });

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

  it('puts the active event time in WIB inside newly sent registration emails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { message_id: 'provider-ticket-001' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendEventTicketEmail({
      event: {
        id: 'event-1',
        title: 'Daurah Aqidah - Racun Atheis',
        speaker: 'Ustadz Dr. Firanda Andirja, M.A.',
        startAt: '2026-09-19T01:00:00.000Z',
        locationName: 'Masjid PUSDAI Kota Bandung',
      },
      attendance: {
        id: 'attendance-1',
        ticketCode: 'YTS-0001',
        person: { fullName: 'Abdullah', email: 'abdullah@example.com', gender: 'ikhwan' },
      },
    })).resolves.toMatchObject({ success: true });

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.content).toContain('08.00 WIB');
    expect(payload.content).not.toContain('01.00 WIB');
  });

  it('separates provider acceptance, bounces, and quota-unprocessed recipients in broadcast history', async () => {
    const db = {
      query: {
        eventAttendance: {
          findMany: async () => [
            {
              registrationData: {
                emailNotifications: {
                  broadcastHistory: [
                    { broadcastId: 'campaign-1', subject: 'Perubahan Jadwal', createdAt: '2026-09-16T01:00:00.000Z', targetRecipients: 3, messageId: 'provider-1', status: 'opened', openedAt: '2026-09-16T01:10:00.000Z' },
                  ],
                },
              },
            },
            {
              registrationData: {
                emailNotifications: {
                  broadcastHistory: [
                    { broadcastId: 'campaign-1', subject: 'Perubahan Jadwal', createdAt: '2026-09-16T01:00:00.000Z', targetRecipients: 3, messageId: 'provider-2', status: 'bounced', bouncedAt: '2026-09-16T01:12:00.000Z' },
                  ],
                },
              },
            },
          ],
        },
      },
    };

    await expect(listEventBroadcastSummaries(db, 'event-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'campaign-1',
        intendedRecipients: 3,
        attemptedCount: 2,
        unattemptedCount: 1,
        providerAcceptedCount: 2,
        openedCount: 1,
        bouncedCount: 1,
        failedCount: 1,
        noNegativeSignalCount: 1,
      }),
    ]);
  });
});
