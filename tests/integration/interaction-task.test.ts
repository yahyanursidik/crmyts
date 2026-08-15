import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerInteractionsRoutes } from '../../server/domain/interactions/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Integration: Interaction Logging & Atomic Task Creation (CRM YTS)', () => {
  const router = new Router();
  registerInteractionsRoutes(router);

  const csUser = {
    id: '018f5555-0000-7000-8000-333333333333',
    authSubject: 'sub_cs',
    email: 'cs@tarbiyahsunnah.id',
    fullName: 'CS Jamaah Care',
    roles: [ROLES.CS_OFFICER],
    permissions: [
      PERMISSIONS.INTERACTIONS_VIEW,
      PERMISSIONS.INTERACTIONS_CREATE,
      PERMISSIONS.TASKS_CREATE,
    ],
    isActive: true,
  };

  it('Logs 60-90s interaction and atomically creates a follow-up task when next action is specified', async () => {
    const mockInteraction = {
      id: 'inter_1',
      personId: '018faaaa-0000-7000-8000-000000000001',
      channel: 'whatsapp',
      summary: 'Jamaah menanyakan jadwal kajian parenting',
      outcome: 'minta_dihubungi_kembali',
      sensitivity: 'normal',
      occurredAt: new Date(),
      ownerUserId: csUser.id,
      createdAt: new Date(),
    };

    const mockTask = {
      id: 'task_1',
      personId: '018faaaa-0000-7000-8000-000000000001',
      title: 'Kirim jadwal kajian parenting pekan depan',
      dueAt: new Date(Date.now() + 86400000),
      priority: 'high',
      status: 'pending',
      ownerUserId: csUser.id,
    };

    const mockTx = {
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([table ? mockInteraction : mockTask]),
        })),
      })),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue({ id: '018faaaa-0000-7000-8000-000000000001', fullName: 'Fulan' }),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_interaction_task',
      method: 'POST',
      path: '/api/interactions',
      headers: {},
      query: {},
      params: {},
      body: {
        personId: '018faaaa-0000-7000-8000-000000000001',
        channel: 'whatsapp',
        summary: 'Jamaah menanyakan jadwal kajian parenting',
        outcome: 'minta_dihubungi_kembali',
        sensitivityLevel: 'standard',
        nextAction: 'Kirim jadwal kajian parenting pekan depan',
        taskDueAt: new Date(Date.now() + 86400000).toISOString(),
        taskPriority: 'high',
      },
      user: csUser,
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.data.interaction.outcome).toBe('minta_dihubungi_kembali');
    expect(mockDb.transaction).toHaveBeenCalled();
  });
});
