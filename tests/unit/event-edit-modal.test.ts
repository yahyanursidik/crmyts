import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';
import { events } from '../../server/db/schema';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Event Edit Feature (PUT /api/events/:id & GET /api/events/:id)', () => {
  const router = new Router();
  registerEventsRoutes(router);

  const mockUser = {
    id: '018f0000-0000-7000-8000-000000000001',
    authSubject: 'sub_admin_1',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Admin Kajian',
    roles: [ROLES.CRM_ADMIN],
    permissions: [PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.EVENTS_VIEW],
    isActive: true,
  };

  const sampleEvent = {
    id: '018f0000-0000-0000-0000-000000000011',
    title: 'Kajian Kitab Tauhid Lama',
    category: 'Kajian Rutin',
    speaker: 'Ustadz Fulan Lama',
    description: 'Deskripsi lama sebelum diedit',
    startAt: new Date('2026-10-01T09:00:00.000Z'),
    endAt: new Date('2026-10-01T11:00:00.000Z'),
    deliveryMode: 'offline',
    locationName: 'Masjid Tarbiyah Sunnah',
    locationAddress: 'Jl. Jurang No. 64 Bandung',
    googleMapsUrl: 'https://maps.app.goo.gl/old',
    locationDirections: 'Pintu gerbang timur',
    showGoogleMaps: true,
    meetingUrl: null,
    status: 'scheduled',
    isRegistrationOpen: true,
    targetAudience: 'umum',
    minAge: null,
    quota: 100,
    quotaIkhwan: 50,
    quotaAkhwat: 50,
    quotaInvite: 20,
    quotaInviteIkhwan: 10,
    quotaInviteAkhwat: 10,
    isPaid: false,
    priceRupiah: 0,
    bankName: null,
    bankAccountNumber: null,
    bankAccountName: null,
    paymentInstructions: null,
    carParkingQuota: 20,
    motorcycleParkingQuota: 100,
    venueRules: [],
    customVenueRules: null,
    formConfig: {},
    createdBy: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('PUT /api/events/:id comprehensively updates all complete event data fields', async () => {
    let capturedUpdatePayload: any = null;

    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(sampleEvent),
        },
      },
      update: vi.fn().mockImplementation((table) => {
        if (table === events) {
          return {
            set: vi.fn().mockImplementation((val) => {
              capturedUpdatePayload = val;
              return {
                where: vi.fn().mockImplementation(() => {
                  return {
                    returning: vi.fn().mockResolvedValue([
                      {
                        ...sampleEvent,
                        ...val,
                      },
                    ]),
                  };
                }),
              };
            }),
          };
        }
        return { set: vi.fn() };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const updateBody = {
      title: 'Kajian Akbar Kitab Tauhid Bab 1 (Telah Direvisi)',
      category: 'Tabligh Akbar',
      speaker: 'Ustadz Dr. Syafiq Riza Basalamah, M.A.',
      description: 'Membahas bab pemurnian ibadah kepada Allah.',
      startAt: '2026-10-05T08:30:00.000Z',
      endAt: '2026-10-05T11:45:00.000Z',
      deliveryMode: 'hybrid',
      status: 'ongoing',
      isRegistrationOpen: true,
      locationName: 'Masjid Agung Al-Ukhuwah Bandung',
      locationAddress: 'Jl. Wastukencana No. 27, Babakan Ciamis, Kota Bandung',
      googleMapsUrl: 'https://maps.app.goo.gl/newlocation',
      locationDirections: 'Gunakan akses pintu utara untuk ikhwan, selatan untuk akhwat.',
      showGoogleMaps: true,
      meetingUrl: 'https://youtube.com/live/kajian-akbar-tauhid',
      targetAudience: 'umum',
      minAge: 12,
      quota: 500,
      quotaIkhwan: 250,
      quotaAkhwat: 250,
      quotaInvite: 50,
      quotaInviteIkhwan: 25,
      quotaInviteAkhwat: 25,
      isPaid: true,
      priceRupiah: 35000,
      bankName: 'Bank Syariah Indonesia (BSI)',
      bankAccountNumber: '7123456789',
      bankAccountName: 'Yayasan Tarbiyah Sunnah',
      paymentInstructions: 'Transfer tepat Rp 35.000 dan sertakan bukti transfer.',
      carParkingQuota: 45,
      motorcycleParkingQuota: 200,
      customVenueRules: 'Wajib membawa sajadah dan mengenakan masker jika batuk/flu.',
    };

    const res = await router.handle({
      path: `/api/events/${sampleEvent.id}`,
      method: 'PUT',
      headers: {},
      query: {},
      params: { id: sampleEvent.id },
      user: mockUser,
      body: updateBody,
      requestId: 'req_test_edit_event_comprehensive',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Verify response contains updated fields
    expect(body.data.title).toBe('Kajian Akbar Kitab Tauhid Bab 1 (Telah Direvisi)');
    expect(body.data.category).toBe('Tabligh Akbar');
    expect(body.data.speaker).toBe('Ustadz Dr. Syafiq Riza Basalamah, M.A.');
    expect(body.data.deliveryMode).toBe('hybrid');
    expect(body.data.status).toBe('ongoing');
    expect(body.data.meetingUrl).toBe('https://youtube.com/live/kajian-akbar-tauhid');
    expect(body.data.isPaid).toBe(true);
    expect(body.data.priceRupiah).toBe(35000);
    expect(body.data.minAge).toBe(12);
    expect(body.data.quota).toBe(500);

    // Verify DB update set payload
    expect(capturedUpdatePayload).not.toBeNull();
    expect(capturedUpdatePayload.title).toBe('Kajian Akbar Kitab Tauhid Bab 1 (Telah Direvisi)');
    expect(capturedUpdatePayload.speaker).toBe('Ustadz Dr. Syafiq Riza Basalamah, M.A.');
    expect(capturedUpdatePayload.locationName).toBe('Masjid Agung Al-Ukhuwah Bandung');
    expect(capturedUpdatePayload.isPaid).toBe(true);
    expect(capturedUpdatePayload.priceRupiah).toBe(35000);
  });

  it('PUT /api/events/:id returns 404 if event does not exist', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/events/non-existent-id',
      method: 'PUT',
      headers: {},
      query: {},
      params: { id: 'non-existent-id' },
      user: mockUser,
      body: {
        title: 'Kajian Baru',
      },
      requestId: 'req_not_found',
    });

    expect(res.statusCode).toBe(404);
  });
});
