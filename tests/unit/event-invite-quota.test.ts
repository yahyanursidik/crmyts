import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';

describe('Dual-Track Quota (Regular & Undangan VIP) & WhatsApp Ticket Feature', () => {
  const router = new Router();
  registerPublicPortalRoutes(router);
  registerEventsRoutes(router);

  const mockAdminUser = {
    id: 'admin-1',
    authSubject: 'sub-admin',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Admin Majelis',
    roles: ['superadmin' as any],
    permissions: ['events:create' as any, 'events:update' as any],
    isActive: true,
  };

  const mockEvent = {
    id: '018f0000-0000-0000-0000-000000000099',
    title: 'Kajian Akbar Bedah Kitab Tauhid',
    category: 'Daurah Khusus',
    speaker: 'Ustadz Yazid bin Abdul Qadir Jawas',
    targetAudience: 'umum',
    startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    deliveryMode: 'offline',
    locationName: 'Masjid Tarbiyah Sunnah',
    isPaid: false,
    priceRupiah: 0,
    status: 'scheduled',
    isRegistrationOpen: true,
    quota: 2,
    quotaIkhwan: 1,
    quotaAkhwat: 1,
    quotaInvite: 2,
    quotaInviteIkhwan: 1,
    quotaInviteAkhwat: 1,
    formConfig: {
      adminInviteCode: 'VIP-UNDANGAN-PANITIA',
    },
    attendances: [
      {
        id: 'att-1',
        eventId: '018f0000-0000-0000-0000-000000000099',
        personId: 'p-1',
        person: {
          id: 'p-1',
          gender: 'ikhwan',
        },
        registrationData: { isSpecialInvite: false },
        referredByAttendanceId: null,
      },
      {
        id: 'att-vip-1',
        eventId: '018f0000-0000-0000-0000-000000000099',
        personId: 'p-vip-1',
        person: {
          id: 'p-vip-1',
          gender: 'ikhwan',
        },
        registrationData: { isSpecialInvite: true, inviteSource: 'admin_dashboard' },
        referredByAttendanceId: null,
      },
    ],
  };

  it('1. GET /api/public/events/:id returns dual quota limits, breakdown counts, and fullness flags', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(mockEvent),
        },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      method: 'GET',
      path: `/api/public/events/${mockEvent.id}`,
      headers: {},
      query: {},
      params: { id: mockEvent.id },
      body: null,
    } as any);

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.event).toBeDefined();
    expect(json.data.event.quota).toBe(2);
    expect(json.data.event.quotaIkhwan).toBe(1);
    expect(json.data.event.quotaAkhwat).toBe(1);
    expect(json.data.event.quotaInvite).toBe(2);
    expect(json.data.event.quotaInviteIkhwan).toBe(1);
    expect(json.data.event.quotaInviteAkhwat).toBe(1);

    expect(json.data.event.regularCount).toBe(1);
    expect(json.data.event.regularIkhwanCount).toBe(1);
    expect(json.data.event.regularAkhwatCount).toBe(0);
    expect(json.data.event.specialInviteCount).toBe(1);
    expect(json.data.event.specialInviteIkhwanCount).toBe(1);
    expect(json.data.event.specialInviteAkhwatCount).toBe(0);

    expect(json.data.event.isRegularFull).toBe(false);
    expect(json.data.event.isInviteFull).toBe(false);
  });

  it('2. POST /api/public/register-event rejects regular ikhwan when regular ikhwan quota is reached', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(mockEvent),
        },
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(null),
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
        eventId: mockEvent.id,
        fullName: 'Ahmad Abdullah',
        phone: '081234567890',
        gender: 'ikhwan',
        agreedToRules: true,
      },
    } as any);

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error.message).toContain('kuota pendaftaran reguler khusus Jamaah Ikhwan tidak mencukupi');
    expect(json.error.message).toContain('sisa 0 slot');
  });

  it('3. POST /api/public/register-event permits regular akhwat when regular akhwat quota is available', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(mockEvent),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-id', fullName: 'Fatimah', ticketCode: 'TKT-AKH-1' }]),
        }),
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
        eventId: mockEvent.id,
        fullName: 'Fatimah binti Fulan',
        phone: '081298765432',
        gender: 'akhwat',
        agreedToRules: true,
      },
    } as any);

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.ticketCode).toBeDefined();
  });

  it('4. POST /api/public/register-event permits VIP invite akhwat via invite referral token', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(mockEvent),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'vip-akh-1', fullName: 'Ustadzah Aisyah', ticketCode: 'VIP-002' }]),
        }),
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
        eventId: mockEvent.id,
        fullName: 'Ustadzah Aisyah',
        phone: '081211112222',
        gender: 'akhwat',
        agreedToRules: true,
        referralCode: 'VIP-UNDANGAN-PANITIA',
      },
    } as any);

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.ticketCode).toBeDefined();
    expect(json.data.isSpecialInvite).toBe(true);
  });

  it('5. POST /api/events/:id/participants/manual registers VIP participant and generates wa.me URL with QR info', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(mockEvent),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'admin-man-1',
              fullName: 'Ustadz Tamu Undangan',
              phoneE164: '+6281233445566',
              ticketCode: 'VIP-MANUAL-101',
            },
          ]),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      method: 'POST',
      path: `/api/events/${mockEvent.id}/participants/manual`,
      headers: { 'content-type': 'application/json' },
      query: {},
      params: { id: mockEvent.id },
      user: mockAdminUser,
      body: {
        fullName: 'Ustadz Tamu Undangan',
        phone: '081233445566',
        gender: 'akhwat',
        age: 40,
        cityRegency: 'Bandung',
        isSpecialInvite: true,
        inviteNotes: 'Tamu Kehormatan Yayasan',
      },
    } as any);

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.data.ticketCode).toBeDefined();
    expect(json.data.waUrl).toContain('https://wa.me/6281233445566?text=');
    expect(json.data.waText).toContain('Tamu Undangan Khusus (VIP)');
    expect(json.data.waText).toContain(mockEvent.title);
    expect(json.data.waText).toContain('KODE E-TIKET PRESENSI');
    expect(json.data.isSpecialInvite).toBe(true);
  });
});
