import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAutomationRoutes } from '../../server/domain/automation/routes';
import * as client from '../../server/db/client';
import { interactions, tasks } from '../../server/db/schema';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Inactive Jamaah Detection & Caring Greetings API', () => {
  const router = new Router();
  registerAutomationRoutes(router);

  const mockUser = {
    id: '018f0000-0000-7000-8000-000000000001',
    authSubject: 'sub_admin_1',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Admin Tarbiyah Sunnah',
    roles: [ROLES.CRM_ADMIN],
    permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.INTERACTIONS_CREATE],
    isActive: true,
  };

  it('GET /api/automation/inactive-attendees returns jamaah who have not attended in >30 days', async () => {
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    const mockAttendances = [
      {
        id: 'att_1',
        personId: '018f0000-0000-0000-0000-000000000001',
        status: 'attended',
        createdAt: fortyFiveDaysAgo,
        checkInAt: fortyFiveDaysAgo,
        person: {
          id: '018f0000-0000-0000-0000-000000000001',
          fullName: 'Fulan bin Fulan (Absen 45 Hari)',
          gender: 'ikhwan',
          phoneE164: '+6281234567890',
          cityRegency: 'Kota Bandung',
        },
        event: {
          id: 'ev_1',
          title: 'Kajian Kitab Tauhid Bab 4',
          speaker: 'Ustadz Dr. Fulan, M.A.',
        },
      },
      {
        id: 'att_2',
        personId: '018f0000-0000-0000-0000-000000000002',
        status: 'attended',
        createdAt: tenDaysAgo,
        checkInAt: tenDaysAgo,
        person: {
          id: '018f0000-0000-0000-0000-000000000002',
          fullName: 'Ahmad Rajin (Aktif 10 Hari Lalu)',
          gender: 'ikhwan',
          phoneE164: '+6281234567891',
          cityRegency: 'Kabupaten Bandung',
        },
        event: {
          id: 'ev_2',
          title: 'Kajian Fiqh Bulughul Maram',
          speaker: 'Ustadz Abu Fulan',
        },
      },
    ];

    const mockDb = {
      query: {
        eventAttendance: {
          findMany: vi.fn().mockResolvedValue(mockAttendances),
        },
        interactions: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        events: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'ev_next_1',
              title: 'Tabligh Akbar Menyambut Ramadan',
              speaker: 'Ustadz Dr. Fulan, M.A.',
              locationName: 'Masjid Tarbiyah Sunnah',
              startAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ]),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/automation/inactive-attendees',
      method: 'GET',
      headers: {},
      query: { minDays: '30' },
      params: {},
      user: mockUser,
      body: null,
      requestId: 'req_inactive_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.totalInactive).toBe(1);
    expect(body.data.items[0].fullName).toContain('Absen 45 Hari');
    expect(body.data.items[0].daysSinceLastAttendance).toBeGreaterThanOrEqual(44);
    expect(body.data.items[0].templates.kabar_doa.message).toContain('Kajian Kitab Tauhid Bab 4');
    expect(body.data.items[0].templates.undangan_kajian.message).toContain('Tabligh Akbar Menyambut Ramadan');
  });

  it('POST /api/automation/send-inactive-greeting logs interaction and creates follow-up task', async () => {
    let insertedInteraction: any = null;
    let insertedTask: any = null;

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000001',
            fullName: 'Fulan bin Fulan',
            phoneE164: '+6281234567890',
          }),
        },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === interactions) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedInteraction = { ...val, id: 'inter_greet_1' };
              return { returning: vi.fn().mockResolvedValue([insertedInteraction]) };
            }),
          };
        }
        if (table === tasks) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedTask = { ...val, id: 'task_greet_1' };
              return { returning: vi.fn().mockResolvedValue([insertedTask]) };
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/automation/send-inactive-greeting',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      user: mockUser,
      body: {
        personId: '018f0000-0000-0000-0000-000000000001',
        templateType: 'kabar_doa',
        message: 'Bismillah, Assalamu\'alaikum Akhi Fulan. Kami merindukan kehadiran antum di majelis ilmu.',
        createFollowupTask: true,
        taskTitle: 'Follow-Up Respon Sapaan Fulan',
        taskDueDate: '2026-08-25',
      },
      requestId: 'req_send_greet_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.waDirectUrl).toContain('https://wa.me/6281234567890');
    expect(insertedInteraction).not.toBeNull();
    expect(insertedInteraction.channel).toBe('whatsapp');
    expect(insertedInteraction.summary).toContain('Sapaan Ukhuwah & Doa Kesehatan');
    expect(insertedTask).not.toBeNull();
    expect(insertedTask.title).toBe('Follow-Up Respon Sapaan Fulan');
  });
});
