import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';
import { eventAttendance, persons } from '../../server/db/schema';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Event Minimum Age (minAge) Feature', () => {
  const router = new Router();
  registerPublicPortalRoutes(router);
  registerEventsRoutes(router);

  const mockUser = {
    id: '018f0000-0000-7000-8000-000000000001',
    authSubject: 'sub_admin_1',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Admin Tarbiyah Sunnah',
    roles: [ROLES.CRM_ADMIN],
    permissions: [PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.EVENTS_VIEW],
    isActive: true,
  };

  const baseEvent = {
    id: '018f0000-0000-0000-0000-000000000099',
    title: 'Daurah Ushul Tsalatsah Remaja & Dewasa',
    category: 'Daurah Khusus',
    speaker: 'Ustadz Fulan Lc.',
    targetAudience: 'umum',
    minAge: 15,
    startAt: new Date('2026-10-01T08:00:00.000Z'),
    deliveryMode: 'offline',
    locationName: 'Masjid Tarbiyah Sunnah',
    isPaid: false,
    priceRupiah: 0,
    isRegistrationOpen: true,
    formConfig: {
      allowMultiParticipant: true,
      requireRulesAgreement: true,
    },
    attendances: [],
  };

  const setupMockDb = (eventData: any, insertedAttendances: any[] = []) => {
    return {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(eventData),
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
            values: vi.fn().mockImplementation((val) => ({
              returning: vi.fn().mockResolvedValue([{ ...val, id: `person_${Math.random().toString(36).slice(2)}` }]),
            })),
          };
        }
        if (table === eventAttendance) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedAttendances.push(val);
              return {
                returning: vi.fn().mockResolvedValue([{ ...val, id: `att_${Math.random().toString(36).slice(2)}` }]),
              };
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
    };
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event Creation and Update with minAge', () => {
    it('creates an event with optional minAge', async () => {
      let insertedValues: any = null;
      const mockDb = {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => {
            insertedValues = val;
            return {
              returning: vi.fn().mockResolvedValue([{ ...val, id: '018f0000-0000-0000-0000-000000000099' }]),
            };
          }),
        })),
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        path: '/api/events',
        method: 'POST',
        headers: {},
        query: {},
        params: {},
        user: mockUser,
        body: {
          title: 'Daurah Kitab Tauhid',
          category: 'Daurah Khusus',
          speaker: 'Ustadz Budi',
          startAt: '2026-10-10T09:00:00Z',
          deliveryMode: 'offline',
          targetAudience: 'umum',
          minAge: 15,
        },
      } as any);

      expect(res.statusCode).toBe(201);
      expect(insertedValues).toBeDefined();
      expect(insertedValues.minAge).toBe(15);
    });

    it('updates an event minAge', async () => {
      let setValues: any = null;
      const mockDb = {
        query: {
          events: {
            findFirst: vi.fn().mockResolvedValue({ id: '018f0000-0000-0000-0000-000000000099', title: 'Daurah' }),
          },
        },
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation((val) => {
            setValues = val;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...val, id: '018f0000-0000-0000-0000-000000000099' }]),
              }),
            };
          }),
        })),
      };

      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        path: '/api/events/018f0000-0000-0000-0000-000000000099',
        method: 'PUT',
        headers: {},
        query: {},
        params: { id: '018f0000-0000-0000-0000-000000000099' },
        user: mockUser,
        body: {
          minAge: 17,
        },
      } as any);

      expect(res.statusCode).toBe(200);
      expect(setValues).toBeDefined();
      expect(setValues.minAge).toBe(17);
    });
  });

  describe('Public Registration minAge Enforcement', () => {
    it('rejects registration when primary registrant age is missing on event with minAge', async () => {
      const mockDb = setupMockDb(baseEvent);
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        path: '/api/public/register-event',
        method: 'POST',
        headers: {},
        query: {},
        params: {},
        body: {
          eventId: baseEvent.id,
          fullName: 'Ahmad bin Fulan',
          phone: '081234567891',
          gender: 'ikhwan',
          agreedToRules: true,
        },
      } as any);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Usia wajib diisi');
      expect(body.error.message).toContain('15 tahun');
    });

    it('rejects registration when primary registrant age is below minAge', async () => {
      const mockDb = setupMockDb(baseEvent);
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        path: '/api/public/register-event',
        method: 'POST',
        headers: {},
        query: {},
        params: {},
        body: {
          eventId: baseEvent.id,
          fullName: 'Ahmad Remaja',
          phone: '081234567892',
          gender: 'ikhwan',
          age: 13,
          agreedToRules: true,
        },
      } as any);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('minimal 15 tahun');
      expect(body.error.message).toContain('13 tahun');
    });

    it('rejects registration when a companion age is below minAge', async () => {
      const mockDb = setupMockDb(baseEvent);
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        path: '/api/public/register-event',
        method: 'POST',
        headers: {},
        query: {},
        params: {},
        body: {
          eventId: baseEvent.id,
          fullName: 'Ahmad Dewasa',
          phone: '081234567893',
          gender: 'ikhwan',
          age: 25,
          agreedToRules: true,
          additionalParticipants: [
            {
              fullName: 'Adik Ziyad',
              relationship: 'Adik',
              age: 12,
            },
          ],
        },
      } as any);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Adik Ziyad');
      expect(body.error.message).toContain('12 tahun');
      expect(body.error.message).toContain('15 tahun');
    });

    it('rejects registration when companion age is missing on event with minAge', async () => {
      const mockDb = setupMockDb(baseEvent);
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        path: '/api/public/register-event',
        method: 'POST',
        headers: {},
        query: {},
        params: {},
        body: {
          eventId: baseEvent.id,
          fullName: 'Ahmad Dewasa',
          phone: '081234567894',
          gender: 'ikhwan',
          age: 25,
          agreedToRules: true,
          additionalParticipants: [
            {
              fullName: 'Teman Ahmad',
              relationship: 'Kerabat',
            },
          ],
        },
      } as any);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Teman Ahmad');
      expect(body.error.message).toContain('wajib diisi');
    });

    it('succeeds and saves age when primary participant and companions meet minAge', async () => {
      const insertedAttendances: any[] = [];
      const mockDb = setupMockDb(baseEvent, insertedAttendances);
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        path: '/api/public/register-event',
        method: 'POST',
        headers: {},
        query: {},
        params: {},
        body: {
          eventId: baseEvent.id,
          fullName: 'Abdullah bin Zaid',
          phone: '081234567895',
          gender: 'ikhwan',
          age: 22,
          agreedToRules: true,
          additionalParticipants: [
            {
              fullName: 'Saudara Zaid',
              relationship: 'Saudara',
              age: 18,
            },
          ],
        },
      } as any);

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(insertedAttendances).toHaveLength(2);
      expect(insertedAttendances[0].age).toBe(22);
      expect(insertedAttendances[1].age).toBe(18);
      expect(body.data.event.minAge).toBe(15);
      expect(body.data.groupTickets[0].age).toBe(22);
      expect(body.data.groupTickets[1].age).toBe(18);
    });

    it('succeeds without age requirement when event minAge is null (backward compatible)', async () => {
      const openAgeEvent = {
        ...baseEvent,
        id: '018f0000-0000-0000-0000-000000000088',
        minAge: null,
      };

      const insertedAttendances: any[] = [];
      const mockDb = setupMockDb(openAgeEvent, insertedAttendances);
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        path: '/api/public/register-event',
        method: 'POST',
        headers: {},
        query: {},
        params: {},
        body: {
          eventId: openAgeEvent.id,
          fullName: 'Bocah Cilik',
          phone: '081234567896',
          gender: 'ikhwan',
          agreedToRules: true,
        },
      } as any);

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.ticketCode).toBeDefined();
      expect(insertedAttendances).toHaveLength(1);
      expect(insertedAttendances[0].age).toBeNull();
    });
  });
});
