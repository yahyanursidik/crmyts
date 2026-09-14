import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import * as client from '../../server/db/client';
import { isEventPast } from '../../src/lib/eventUtils';
import { eventAttendance, persons } from '../../server/db/schema';

describe('Past Events & Registration Deactivation Feature', () => {
  const router = new Router();
  registerPublicPortalRoutes(router);

  const pastEventEnded = {
    id: '018f0000-0000-0000-0000-000000000001',
    title: 'Kajian Subuh Tematik Kemarin',
    category: 'Kajian Rutin',
    speaker: 'Ustadz Fulan Lc.',
    targetAudience: 'umum',
    startAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Kemarin
    endAt: new Date(Date.now() - 22 * 60 * 60 * 1000),   // Berakhir kemarin
    deliveryMode: 'offline',
    locationName: 'Masjid Tarbiyah Sunnah',
    isPaid: false,
    priceRupiah: 0,
    status: 'scheduled',
    isRegistrationOpen: true,
    formConfig: {},
    attendances: [],
  };

  const pastEventNoEndAt = {
    id: '018f0000-0000-0000-0000-000000000002',
    title: 'Kajian Dhuha 4 Jam Lalu',
    category: 'Kajian Rutin',
    speaker: 'Ustadz Fulan Lc.',
    targetAudience: 'umum',
    startAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 jam lalu, tanpa endAt
    endAt: null,
    deliveryMode: 'offline',
    locationName: 'Masjid Tarbiyah Sunnah',
    isPaid: false,
    priceRupiah: 0,
    status: 'scheduled',
    isRegistrationOpen: true,
    formConfig: {},
    attendances: [],
  };

  const completedEvent = {
    id: '018f0000-0000-0000-0000-000000000003',
    title: 'Daurah Tajwid Selesai',
    category: 'Daurah Khusus',
    speaker: 'Ustadz Fulan Lc.',
    targetAudience: 'umum',
    startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 26 * 60 * 60 * 1000),
    deliveryMode: 'offline',
    locationName: 'Masjid Tarbiyah Sunnah',
    isPaid: false,
    priceRupiah: 0,
    status: 'completed',
    isRegistrationOpen: true,
    formConfig: {},
    attendances: [],
  };

  const upcomingEvent = {
    id: '018f0000-0000-0000-0000-000000000004',
    title: 'Kajian Akhir Pekan Mendatang',
    category: 'Kajian Rutin',
    speaker: 'Ustadz Fulan Lc.',
    targetAudience: 'umum',
    startAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 hari lagi
    endAt: new Date(Date.now() + 50 * 60 * 60 * 1000),
    deliveryMode: 'offline',
    locationName: 'Masjid Tarbiyah Sunnah',
    isPaid: false,
    priceRupiah: 0,
    status: 'scheduled',
    isRegistrationOpen: true,
    formConfig: {
      requireRulesAgreement: true,
    },
    attendances: [],
  };

  describe('isEventPast Helper Unit Tests', () => {
    it('returns true if event status is completed or cancelled', () => {
      expect(isEventPast({ startAt: new Date(Date.now() + 100000), status: 'completed' })).toBe(true);
      expect(isEventPast({ startAt: new Date(Date.now() + 100000), status: 'cancelled' })).toBe(true);
    });

    it('returns true if endAt has passed', () => {
      const pastEnd = new Date(Date.now() - 10000);
      expect(isEventPast({ startAt: new Date(Date.now() - 20000), endAt: pastEnd, status: 'scheduled' })).toBe(true);
    });

    it('returns false if endAt is still in the future', () => {
      const futureEnd = new Date(Date.now() + 60000);
      expect(isEventPast({ startAt: new Date(Date.now() - 10000), endAt: futureEnd, status: 'scheduled' })).toBe(false);
    });

    it('returns true if endAt is null and startAt + 2 hours has passed', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(isEventPast({ startAt: threeHoursAgo, endAt: null, status: 'scheduled' })).toBe(true);
    });

    it('returns false if endAt is null and startAt is recent (under 2 hours)', () => {
      const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
      expect(isEventPast({ startAt: halfHourAgo, endAt: null, status: 'scheduled' })).toBe(false);
    });

    it('returns false if startAt is in the future', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(isEventPast({ startAt: tomorrow, endAt: null, status: 'scheduled' })).toBe(false);
    });
  });

  describe('GET /api/public/portal-info', () => {
    it('excludes past and completed events from upcoming events list', async () => {
      const mockDb = {
        query: {
          donationPrograms: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          events: {
            findMany: vi.fn().mockResolvedValue([
              pastEventEnded,
              pastEventNoEndAt,
              completedEvent,
              upcomingEvent,
            ]),
          },
          bazaarEvents: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ totalRupiah: '0', count: 0 }]),
          }),
        }),
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        method: 'GET',
        path: '/api/public/portal-info',
        headers: {},
        query: {},
        params: {},
        body: null,
      } as any);

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.events).toHaveLength(1);
      expect(body.data.events[0].id).toBe(upcomingEvent.id);
      expect(body.data.events[0].title).toBe(upcomingEvent.title);
      expect(body.data.events[0].isPast).toBe(false);
    });
  });

  describe('GET /api/public/events/:id', () => {
    it('returns event detail with isPast: true and isRegistrationOpen: false for past event', async () => {
      const mockDb = {
        query: {
          events: {
            findFirst: vi.fn().mockResolvedValue(pastEventEnded),
          },
        },
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        method: 'GET',
        path: `/api/public/events/${pastEventEnded.id}`,
        headers: {},
        query: {},
        params: { id: pastEventEnded.id },
        body: null,
      } as any);

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.event.id).toBe(pastEventEnded.id);
      expect(body.data.event.isPast).toBe(true);
      expect(body.data.event.isRegistrationOpen).toBe(false);
    });

    it('returns event detail with isPast: false for upcoming event', async () => {
      const mockDb = {
        query: {
          events: {
            findFirst: vi.fn().mockResolvedValue(upcomingEvent),
          },
        },
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        method: 'GET',
        path: `/api/public/events/${upcomingEvent.id}`,
        headers: {},
        query: {},
        params: { id: upcomingEvent.id },
        body: null,
      } as any);

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.event.id).toBe(upcomingEvent.id);
      expect(body.data.event.isPast).toBe(false);
      expect(body.data.event.isRegistrationOpen).toBe(true);
    });
  });

  describe('POST /api/public/register-event', () => {
    it('rejects registration for event that has already ended (endAt < now)', async () => {
      const mockDb = {
        query: {
          events: {
            findFirst: vi.fn().mockResolvedValue(pastEventEnded),
          },
        },
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        method: 'POST',
        path: '/api/public/register-event',
        headers: { 'content-type': 'application/json' },
        query: {},
        params: {},
        body: {
          eventId: pastEventEnded.id,
          fullName: 'Ahmad Abdullah',
          phone: '081234567890',
          gender: 'ikhwan',
          agreedToRules: true,
        },
      } as any);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('selesai dilaksanakan atau telah berlalu');
    });

    it('rejects registration for event whose startAt was > 2 hours ago with no endAt', async () => {
      const mockDb = {
        query: {
          events: {
            findFirst: vi.fn().mockResolvedValue(pastEventNoEndAt),
          },
        },
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        method: 'POST',
        path: '/api/public/register-event',
        headers: { 'content-type': 'application/json' },
        query: {},
        params: {},
        body: {
          eventId: pastEventNoEndAt.id,
          fullName: 'Ahmad Abdullah',
          phone: '081234567890',
          gender: 'ikhwan',
          agreedToRules: true,
        },
      } as any);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('selesai dilaksanakan atau telah berlalu');
    });

    it('rejects registration for completed event', async () => {
      const mockDb = {
        query: {
          events: {
            findFirst: vi.fn().mockResolvedValue(completedEvent),
          },
        },
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        method: 'POST',
        path: '/api/public/register-event',
        headers: { 'content-type': 'application/json' },
        query: {},
        params: {},
        body: {
          eventId: completedEvent.id,
          fullName: 'Ahmad Abdullah',
          phone: '081234567890',
          gender: 'ikhwan',
          agreedToRules: true,
        },
      } as any);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('selesai dilaksanakan atau telah berlalu');
    });

    it('allows registration for upcoming event', async () => {
      const insertedPerson = {
        id: '018f0000-0000-7000-8000-000000000100',
        fullName: 'Ahmad Abdullah',
        phone: '081234567890',
        gender: 'ikhwan',
      };

      const mockDb = {
        query: {
          events: {
            findFirst: vi.fn().mockResolvedValue(upcomingEvent),
          },
          persons: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          eventAttendance: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: vi.fn().mockImplementation((table) => {
          if (table === persons) {
            return {
              values: vi.fn().mockImplementation(() => ({
                returning: vi.fn().mockResolvedValue([insertedPerson]),
              })),
            };
          }
          if (table === eventAttendance) {
            return {
              values: vi.fn().mockImplementation(() => ({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: '018f0000-0000-7000-8000-000000000200',
                    ticketCode: 'YTS-TEST1',
                    eventId: upcomingEvent.id,
                    personId: insertedPerson.id,
                    status: 'registered',
                  },
                ]),
              })),
            };
          }
          return {
            values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
          };
        }),
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        method: 'POST',
        path: '/api/public/register-event',
        headers: { 'content-type': 'application/json' },
        query: {},
        params: {},
        body: {
          eventId: upcomingEvent.id,
          fullName: 'Ahmad Abdullah',
          phone: '081234567890',
          gender: 'ikhwan',
          agreedToRules: true,
        },
      } as any);

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.ticketCode).toBeDefined();
    });
  });
});
