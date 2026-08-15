import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';
import { eventAttendance, persons } from '../../server/db/schema';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Multi-Participant & Family Group Registration API', () => {
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

  it('registers primary registrant + 2 family members in one submission and generates individual tickets', async () => {
    const mockEvent = {
      id: '018f0000-0000-0000-0000-000000000055',
      title: "Program I'tikaf 10 Malam Terakhir Ramadan",
      category: 'Program Ramadan',
      speaker: 'Asatidzah Tarbiyah Sunnah',
      targetAudience: 'itikaf_ramadan',
      startAt: new Date('2026-04-05T17:00:00.000Z'),
      deliveryMode: 'offline',
      locationName: 'Masjid Tarbiyah Sunnah',
      isPaid: true,
      priceRupiah: 100000,
      bankName: 'Bank BSI',
      bankAccountNumber: '7123456789',
      bankAccountName: 'Yayasan Tarbiyah Sunnah',
      isRegistrationOpen: true,
      attendances: [],
    };

    const insertedAttendances: any[] = [];
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
      insert: vi.fn().mockImplementation((table) => {
        if (table === persons) {
          return {
            values: vi.fn().mockImplementation((val) => {
              return {
                returning: vi.fn().mockResolvedValue([{ ...val, id: `person_${Math.random().toString(36).substr(2, 6)}` }]),
              };
            }),
          };
        }
        if (table === eventAttendance) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedAttendances.push(val);
              return {
                returning: vi.fn().mockResolvedValue([{ ...val, id: `att_${Math.random().toString(36).substr(2, 6)}` }]),
              };
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/register-event',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: mockEvent.id,
        fullName: 'Abu Ziyad Abdullah',
        phone: '081234567890',
        gender: 'ikhwan',
        cityRegency: 'Kota Bandung',
        paymentProofUrl: 'data:image/png;base64,mockproof',
        additionalParticipants: [
          {
            fullName: 'Ummu Ziyad',
            gender: 'akhwat',
            relationship: 'Istri',
            age: 35,
            notes: 'Membawa perlengkapan ibadah mandiri',
          },
          {
            fullName: 'Ziyad bin Abdullah',
            gender: 'ikhwan',
            relationship: 'Anak Laki-laki',
            age: 10,
          },
        ],
      },
      requestId: 'req_family_reg_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.isGroupRegistration).toBe(true);
    expect(body.data.totalParticipantsCount).toBe(3);
    expect(body.data.groupTickets.length).toBe(3);
    expect(body.data.event.totalPriceRupiah).toBe(300000); // 3 x 100,000
    expect(insertedAttendances.length).toBe(3);
    expect(insertedAttendances[0].registrationGroupId).toBeDefined();
    expect(insertedAttendances[1].registrationGroupId).toBe(insertedAttendances[0].registrationGroupId);
    expect(insertedAttendances[2].registrationGroupId).toBe(insertedAttendances[0].registrationGroupId);
  });

  it('verifies all group members when one member payment is approved', async () => {
    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000088',
            eventId: '018f0000-0000-0000-0000-000000000055',
            registrationGroupId: 'GRP-20260405-ABCD',
            paymentStatus: 'waiting_verification',
          }),
        },
      },
      update: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            set: vi.fn().mockImplementation((val) => {
              return {
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([
                    { id: 'att_1', registrationGroupId: 'GRP-20260405-ABCD', ...val },
                    { id: 'att_2', registrationGroupId: 'GRP-20260405-ABCD', ...val },
                    { id: 'att_3', registrationGroupId: 'GRP-20260405-ABCD', ...val },
                  ]),
                }),
              };
            }),
          };
        }
        return { set: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/events/018f0000-0000-0000-0000-000000000055/attendances/018f0000-0000-0000-0000-000000000088/verify-payment',
      method: 'POST',
      headers: {},
      query: {},
      params: {
        id: '018f0000-0000-0000-0000-000000000055',
        attendanceId: '018f0000-0000-0000-0000-000000000088',
      },
      user: mockUser,
      body: {},
      requestId: 'req_family_verify_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.updatedCount).toBe(3);
    expect(body.data.message).toContain('3 orang');
  });
});
