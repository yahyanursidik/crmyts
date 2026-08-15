import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerWaqfRoutes } from '../../server/domain/waqf/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import { waqfStageHistory, tasks, auditLogs } from '../../server/db/schema';

describe('Waqf Pipeline & Server-Side Transitions (Step 12 / M08)', () => {
  const router = new Router();
  registerWaqfRoutes(router);

  const waqfOfficerUser = {
    id: '018f5555-0000-7000-8000-333333333333',
    authSubject: 'sub_waqf',
    email: 'waqf@tarbiyahsunnah.id',
    fullName: 'Waqf Officer',
    roles: [ROLES.WAQF_OFFICER],
    permissions: [
      PERMISSIONS.WAQF_CREATE,
      PERMISSIONS.WAQF_LIST,
      PERMISSIONS.WAQF_VIEW_DETAIL,
      PERMISSIONS.WAQF_TRANSITION,
      PERMISSIONS.WAQF_EDIT,
    ],
    isActive: true,
  };

  const csUserWithoutTransition = {
    id: '018f6666-0000-7000-8000-444444444444',
    authSubject: 'sub_cs',
    email: 'cs@tarbiyahsunnah.id',
    fullName: 'CS Staff',
    roles: [ROLES.CS_OFFICER],
    permissions: [PERMISSIONS.PERSONS_LIST],
    isActive: true,
  };

  it('Waqf officer can execute 6-step atomic stage transition with stage history, audit, and next task', async () => {
    const insertedStageHistory: any[] = [];
    const insertedAuditLogs: any[] = [];
    const insertedTasks: any[] = [];

    const mockExistingCase = {
      id: '018f0000-0000-0000-0000-000000000088',
      personId: '018f0000-0000-0000-0000-000000000001',
      waqfType: 'tanah',
      estimatedValueRupiah: BigInt(2500000000),
      currentStage: 'interested',
      ownerUserId: waqfOfficerUser.id,
    };

    const mockTx = {
      query: {
        waqfCases: {
          findFirst: vi.fn().mockResolvedValue(mockExistingCase),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: () =>
              Promise.resolve([
                {
                  ...mockExistingCase,
                  currentStage: 'consulted',
                },
              ]),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === waqfStageHistory || table?.name === 'waqf_stage_history' || table?._?.name === 'waqf_stage_history') {
              const row = { id: 'hist_1', ...data };
              insertedStageHistory.push(row);
              return { returning: () => Promise.resolve([row]) };
            }
            if (table === auditLogs || table?.name === 'audit_logs' || table?._?.name === 'audit_logs') {
              insertedAuditLogs.push(data);
              return Promise.resolve();
            }
            if (table === tasks || table?.name === 'tasks' || table?._?.name === 'tasks') {
              const row = { id: 'task_waqf_1', ...data };
              insertedTasks.push(row);
              return { returning: () => Promise.resolve([row]) };
            }
            return { returning: () => Promise.resolve([{ id: 'mock' }]) };
          }),
        };
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_waqf_transition',
      method: 'POST',
      path: '/api/waqf/018f0000-0000-0000-0000-000000000088/transition',
      headers: {},
      query: {},
      params: { id: '018f0000-0000-0000-0000-000000000088' },
      user: waqfOfficerUser,
      body: {
        toStage: 'consulted',
        reason: 'Konsultasi kelayakan sertifikat tanah dan status sengketa bersama asatidz yayasan',
        nextAction: 'Jadwalkan survei lokasi tanah wakaf bersama tim teknis',
        taskDueAt: new Date(Date.now() + 86400000 * 4).toISOString(),
        taskPriority: 'high',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.currentStage).toBe('consulted');
    expect(json.data.createdTask).toBeDefined();

    // Verify stage history recorded
    expect(insertedStageHistory.length).toBe(1);
    expect(insertedStageHistory[0].fromStage).toBe('interested');
    expect(insertedStageHistory[0].toStage).toBe('consulted');

    // Verify audit log recorded
    expect(insertedAuditLogs.length).toBe(1);
    expect(insertedAuditLogs[0].action).toBe('transition_waqf_stage');

    // Verify follow-up task atomically created
    expect(insertedTasks.length).toBe(1);
    expect(insertedTasks[0].title.toLowerCase()).toContain('survei lokasi tanah wakaf');
    expect(insertedTasks[0].priority).toBe('high');
  });

  it('User without WAQF_TRANSITION permission is FORBIDDEN (403)', async () => {
    const mockDb = {
      query: { waqfCases: { findFirst: vi.fn() } },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_waqf_unauthorized',
      method: 'POST',
      path: '/api/waqf/018f0000-0000-0000-0000-000000000088/transition',
      headers: {},
      query: {},
      params: { id: '018f0000-0000-0000-0000-000000000088' },
      user: csUserWithoutTransition,
      body: {
        toStage: 'consulted',
        reason: 'Percobaan tanpa izin',
      },
    });

    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('FORBIDDEN');
  });
});
