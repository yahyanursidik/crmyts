import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';
import { events, eventAttendance } from '../../server/db/schema';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Paid Events & Payment Proof Verification System', () => {
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

  it('POST /api/events creates a paid event with price and banking details', async () => {
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
        title: 'Daurah Ushul Tsalatsah Bersanad',
        category: 'Daurah Khusus',
        speaker: 'Ustadz Abu Haidar As-Sundawy, Lc.',
        startAt: '2026-09-01T09:00:00.000Z',
        deliveryMode: 'offline',
        locationName: 'Masjid Tarbiyah Sunnah',
        isPaid: true,
        priceRupiah: 75000,
        bankName: 'Bank Syariah Indonesia (BSI)',
        bankAccountNumber: '7123456789',
        bankAccountName: 'Yayasan Tarbiyah Sunnah',
        paymentInstructions: 'Transfer sesuai nominal. Cantumkan nama di berita transfer.',
      },
      requestId: 'req_paid_1',
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Daurah Ushul Tsalatsah Bersanad');
    expect(insertedEvent.isPaid).toBe(true);
    expect(insertedEvent.priceRupiah).toBe(75000);
    expect(insertedEvent.bankAccountNumber).toBe('7123456789');
  });

  it('POST /api/events/:id/attendances/:attendanceId/verify-payment approves participant payment', async () => {
    let updatedAttendance: any = null;

    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000088',
            eventId: '018f0000-0000-0000-0000-000000000099',
            paymentStatus: 'waiting_verification',
            status: 'registered',
          }),
        },
      },
      update: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            set: vi.fn().mockImplementation((val) => {
              updatedAttendance = {
                id: '018f0000-0000-0000-0000-000000000088',
                ...val,
              };
              return {
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([updatedAttendance]),
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
      path: '/api/events/018f0000-0000-0000-0000-000000000099/attendances/018f0000-0000-0000-0000-000000000088/verify-payment',
      method: 'POST',
      headers: {},
      query: {},
      params: {
        id: '018f0000-0000-0000-0000-000000000099',
        attendanceId: '018f0000-0000-0000-0000-000000000088',
      },
      user: mockUser,
      body: {},
      requestId: 'req_paid_2',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.attendance).toBeDefined();
    expect(updatedAttendance.paymentStatus).toBe('verified');
    expect(updatedAttendance.paymentVerifiedBy).toBe(mockUser.id);
  });

  it('POST /api/events/:id/attendances/:attendanceId/reject-payment rejects with reason', async () => {
    let updatedAttendance: any = null;

    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000088',
            eventId: '018f0000-0000-0000-0000-000000000099',
            paymentStatus: 'waiting_verification',
          }),
        },
      },
      update: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            set: vi.fn().mockImplementation((val) => {
              updatedAttendance = {
                id: '018f0000-0000-0000-0000-000000000088',
                ...val,
              };
              return {
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([updatedAttendance]),
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
      path: '/api/events/018f0000-0000-0000-0000-000000000099/attendances/018f0000-0000-0000-0000-000000000088/reject-payment',
      method: 'POST',
      headers: {},
      query: {},
      params: {
        id: '018f0000-0000-0000-0000-000000000099',
        attendanceId: '018f0000-0000-0000-0000-000000000088',
      },
      user: mockUser,
      body: {
        rejectionReason: 'Nominal transfer tidak sesuai (kurang Rp 25.000)',
      },
      requestId: 'req_paid_3',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.attendance).toBeDefined();
    expect(updatedAttendance.paymentStatus).toBe('rejected');
    expect(updatedAttendance.paymentRejectionReason).toBe('Nominal transfer tidak sesuai (kurang Rp 25.000)');
  });
});
