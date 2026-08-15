import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerTasksRoutes } from '../../server/domain/tasks/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import * as client from '../../server/db/client';

describe('Tasks & Visitation Assignment with WhatsApp Template (M07)', () => {
  const router = new Router();
  registerTasksRoutes(router);

  const csUser = {
    id: '018f9999-0000-7000-8000-222222222222',
    authSubject: 'sub_cs_tasks',
    email: 'cs@tarbiyahsunnah.id',
    fullName: 'Ustadz Ahmad CS',
    roles: [ROLES.CS_OFFICER],
    permissions: Object.values(PERMISSIONS),
    isActive: true,
  };

  const assignedStaff = {
    id: '018f9999-0000-7000-8000-333333333333',
    fullName: 'Akhi Fulan Amil',
    email: 'fulan@tarbiyahsunnah.id',
  };

  const targetPerson = {
    id: '018f9999-0000-7000-8000-444444444444',
    fullName: 'Bapak H. Muhsin',
    phoneE164: '+628123456789',
    cityRegency: 'Bandung',
    email: 'muhsin@example.com',
  };

  it('1. GET /api/tasks generates WhatsApp visitation message with required wording', async () => {
    const mockDb = {
      query: {
        tasks: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-555555555555',
              title: 'Silaturahmi & Penjelasan Wakaf',
              description: 'Penjelasan progres [TYPE:kunjungan] [LOKASI:Dago No. 12, Bandung]',
              status: 'pending',
              priority: 'high',
              dueAt: new Date('2026-08-20T10:00:00.000Z'),
              person: targetPerson,
              owner: assignedStaff,
            },
          ]),
        },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_tasks_list',
      method: 'GET',
      path: '/api/tasks',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: csUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.length).toBe(1);
    const task = json.data[0];
    
    expect(task.taskType).toBe('kunjungan');
    expect(task.visitLocation).toBe('Dago No. 12, Bandung');
    expect(task.waVisitationMessage).toContain('Yayasan Tarbiyah Sunnah menugaskan Akhi Fulan Amil untuk bersilaturahmi dan bertemu');
    expect(task.waVisitationMessage).toContain('Terima kasih banyak sudah berkenan menerima kami');
    expect(task.waVisitationMessage).toContain('Barakallahu fiikum');
    expect(task.waDirectUrl).toContain('https://wa.me/628123456789?text=');
  });

  it('2. POST /api/tasks creates task assigned to another admin/staff', async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-666666666666',
              title: 'Kunjungan Waqif Rumah Yatim',
              ownerUserId: assignedStaff.id,
              status: 'pending',
              dueAt: new Date('2026-08-22T09:00:00.000Z'),
            },
          ]),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_tasks_create',
      method: 'POST',
      path: '/api/tasks',
      headers: {},
      query: {},
      params: {},
      body: {
        title: 'Kunjungan Waqif Rumah Yatim',
        taskType: 'kunjungan',
        personId: targetPerson.id,
        ownerUserId: assignedStaff.id,
        priority: 'high',
        dueAt: '2026-08-22T09:00:00.000Z',
        visitLocation: 'Jl. Riau No. 45, Bandung',
      },
      user: csUser,
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.data.id).toBe('018f9999-0000-7000-8000-666666666666');
  });

  it('3. POST /api/tasks/:id/dispatch-email sends visitation email notice', async () => {
    const mockDb = {
      query: {
        tasks: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f9999-0000-7000-8000-666666666666',
            title: 'Kunjungan Silaturahmi',
            person: targetPerson,
            owner: assignedStaff,
          }),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_tasks_email',
      method: 'POST',
      path: '/api/tasks/018f9999-0000-7000-8000-666666666666/dispatch-email',
      headers: {},
      query: {},
      params: { id: '018f9999-0000-7000-8000-666666666666' },
      body: {
        recipientEmail: 'muhsin@example.com',
      },
      user: csUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.sent).toBe(true);
  });
});
