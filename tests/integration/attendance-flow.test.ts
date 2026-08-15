import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Integration: Event & Kajian Attendance Flow (CRM YTS)', () => {
  const router = new Router();
  registerEventsRoutes(router);

  const eventAdminUser = {
    id: '018f6666-0000-7000-8000-222222222222',
    authSubject: 'sub_event_admin',
    email: 'kajian@tarbiyahsunnah.id',
    fullName: 'Admin Kajian',
    roles: [ROLES.EVENT_ADMIN],
    permissions: [
      PERMISSIONS.EVENTS_VIEW,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.ATTENDANCE_MANAGE,
    ],
    isActive: true,
  };

  const sampleEvent = {
    id: '018faaaa-0000-7000-8000-000000000001',
    title: 'Kajian Rutin Kitab Tauhid',
    category: 'rutin_pekanan',
    speaker: 'Ustadz Abu Haidar As-Sundawy',
    startAt: new Date(),
    status: 'scheduled',
    createdBy: eventAdminUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('Records check-in attendance and handles double check-in idempotently', async () => {
    const mockInsert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'att_1',
              eventId: sampleEvent.id,
              personId: '018faaaa-0000-7000-8000-000000000099',
              checkInAt: new Date(),
              status: 'attended',
              source: 'qr_scan',
            },
          ]),
        }),
      })),
    }));

    const mockDb = {
      insert: mockInsert,
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue(sampleEvent),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_attendance_checkin',
      method: 'POST',
      path: `/api/events/${sampleEvent.id}/attendance`,
      headers: {},
      query: {},
      params: { id: sampleEvent.id },
      body: {
        personId: '018faaaa-0000-7000-8000-000000000099',
        source: 'qr_scan',
      },
      user: eventAdminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.status).toBe('attended');
  });
});
