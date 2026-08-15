import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';
import { events, eventAttendance } from '../../server/db/schema';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Events Management & Form Builder API', () => {
  const router = new Router();
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

  it('POST /api/events creates an event with Audience Segmentation, Quotas, Parking & Rules', async () => {
    let insertedEvent: any = null;

    const mockDb = {
      insert: vi.fn().mockImplementation((table) => {
        if (table === events) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedEvent = { ...val, id: '018f0000-0000-0000-0000-000000000099' };
              return { returning: vi.fn().mockResolvedValue([insertedEvent]) };
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
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
        title: 'Daurah Sanad Matan Jazariyyah (Khusus Akhwat)',
        category: 'Daurah Khusus',
        speaker: 'Ustadzah Ummu Fulan, Lc.',
        description: 'Pembahasan tajwid bersanad muttashil.',
        startAt: '2026-08-25T08:30:00.000Z',
        deliveryMode: 'offline',
        locationName: 'Masjid Tarbiyah Sunnah',
        targetAudience: 'akhwat_only',
        quota: 100,
        quotaAkhwat: 100,
        carParkingQuota: 20,
        motorcycleParkingQuota: 80,
        venueRules: ['no_toddlers', 'modest_dress', 'bring_kitab'],
        customVenueRules: 'Dilarang membawa makanan ke dalam ruangan.',
        isRegistrationOpen: true,
        formConfig: {
          collectEmail: true,
          collectCity: true,
          collectNotes: true,
          requireGender: true,
          collectVehicle: true,
          customFields: [
            {
              id: 'fld_tajwid_exp',
              label: 'Sudah pernah menghafal Tuhfatul Athfal?',
              type: 'radio',
              required: true,
              options: ['Sudah Hafal', 'Sedang Menghafal', 'Belum Pernah'],
            },
          ],
          whatsappMessageTemplate: 'Bismillah. Pendaftaran Daurah Sanad Anda diterima. Tiket: {{ticket_code}}',
        },
      },
      requestId: 'req_ev_form_1',
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Daurah Sanad Matan Jazariyyah (Khusus Akhwat)');
    expect(body.data.targetAudience).toBe('akhwat_only');
    expect(body.data.quotaAkhwat).toBe(100);
    expect(body.data.carParkingQuota).toBe(20);
    expect(body.data.venueRules).toContain('no_toddlers');
    expect(insertedEvent.targetAudience).toBe('akhwat_only');
  });

  it('GET /api/events/:id returns event details with participants and logistics', async () => {
    const mockDetail = {
      id: '018f0000-0000-0000-0000-000000000099',
      title: 'Daurah Sanad Matan Jazariyyah',
      category: 'Daurah Khusus',
      speaker: 'Ustadz Dr. Fulan, M.A.',
      targetAudience: 'akhwat_only',
      startAt: new Date('2026-08-25T08:30:00.000Z'),
      deliveryMode: 'offline',
      quota: 100,
      quotaAkhwat: 100,
      carParkingQuota: 20,
      motorcycleParkingQuota: 80,
      venueRules: ['no_toddlers', 'modest_dress'],
      isRegistrationOpen: true,
      formConfig: {
        collectEmail: true,
        customFields: [{ id: 'fld_1', label: 'Tingkat Tajwid', type: 'text', required: true }],
      },
      creator: {
        id: '018f0000-0000-7000-8000-000000000001',
        fullName: 'Admin Tarbiyah Sunnah',
        email: 'admin@tarbiyahsunnah.id',
      },
      attendances: [
        {
          id: 'att_1',
          personId: '018f0000-0000-0000-0000-000000000011',
          checkInAt: new Date(),
          source: 'form_registration',
          status: 'registered',
          ticketCode: 'TIKET-KJN-260825-9999',
          vehicleType: 'car',
          vehiclePlateNumber: 'D 1234 ABC',
          agreedToRules: true,
          registrationData: { fld_1: 'Tingkat Menengah' },
          person: {
            id: '018f0000-0000-0000-0000-000000000011',
            fullName: 'Fathimah Penuntut Ilmu',
            phoneE164: '+6281234567899',
            gender: 'akhwat',
            email: 'fathimah@example.com',
            cityRegency: 'Kota Bandung',
          },
        },
      ],
    };

    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(mockDetail),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/events/018f0000-0000-0000-0000-000000000099',
      method: 'GET',
      headers: {},
      query: {},
      params: { id: '018f0000-0000-0000-0000-000000000099' },
      user: mockUser,
      body: null,
      requestId: 'req_ev_detail_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Daurah Sanad Matan Jazariyyah');
    expect(body.data.targetAudience).toBe('akhwat_only');
    expect(body.data.participants.length).toBe(1);
    expect(body.data.participants[0].personName).toBe('Fathimah Penuntut Ilmu');
    expect(body.data.participants[0].vehicleType).toBe('car');
    expect(body.data.participants[0].vehiclePlateNumber).toBe('D 1234 ABC');
    expect(body.data.carsCount).toBe(1);
    expect(body.data.akhwatCount).toBe(1);
  });

  it('PUT /api/events/:id updates quotas, target audience and rules', async () => {
    let updatedEvent: any = null;

    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({ id: '018f0000-0000-0000-0000-000000000099' }),
        },
      },
      update: vi.fn().mockImplementation((table) => {
        if (table === events) {
          return {
            set: vi.fn().mockImplementation((val) => ({
              where: vi.fn().mockImplementation(() => {
                updatedEvent = { id: '018f0000-0000-0000-0000-000000000099', ...val };
                return { returning: vi.fn().mockResolvedValue([updatedEvent]) };
              }),
            })),
          };
        }
        return { set: vi.fn() };
      }),
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
        targetAudience: 'itikaf_ramadan',
        quota: 120,
        carParkingQuota: 30,
        venueRules: ['stay_overnight', 'no_toddlers'],
      },
      requestId: 'req_ev_update_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.targetAudience).toBe('itikaf_ramadan');
    expect(body.data.quota).toBe(120);
    expect(body.data.carParkingQuota).toBe(30);
    expect(updatedEvent.targetAudience).toBe('itikaf_ramadan');
  });

  it('POST /api/events/:id/toggle-attendance toggles attendance check-in status', async () => {
    let toggledAttendance: any = null;

    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'att_1',
            eventId: '018f0000-0000-0000-0000-000000000099',
            status: 'registered',
          }),
        },
      },
      update: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            set: vi.fn().mockImplementation((val) => ({
              where: vi.fn().mockImplementation(() => {
                toggledAttendance = { id: 'att_1', ...val };
                return { returning: vi.fn().mockResolvedValue([toggledAttendance]) };
              }),
            })),
          };
        }
        return { set: vi.fn() };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/events/018f0000-0000-0000-0000-000000000099/toggle-attendance',
      method: 'POST',
      headers: {},
      query: {},
      params: { id: '018f0000-0000-0000-0000-000000000099' },
      user: mockUser,
      body: { attendanceId: 'att_1' },
      requestId: 'req_ev_toggle_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('attended');
    expect(toggledAttendance.status).toBe('attended');
  });
});
