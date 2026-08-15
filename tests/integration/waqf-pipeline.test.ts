import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerWaqfRoutes } from '../../server/domain/waqf/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import { waqfStageHistory, tasks, auditLogs } from '../../server/db/schema';

describe('Integration: Waqf 7-Stage Pipeline & Stewardship (CRM YTS)', () => {
  const router = new Router();
  registerWaqfRoutes(router);

  const waqfUser = {
    id: '018f3333-0000-7000-8000-555555555555',
    authSubject: 'sub_waqf',
    email: 'waqf@tarbiyahsunnah.id',
    fullName: 'Wakaf Officer',
    roles: [ROLES.WAQF_OFFICER],
    permissions: [
      PERMISSIONS.WAQF_LIST,
      PERMISSIONS.WAQF_VIEW_SUMMARY,
      PERMISSIONS.WAQF_VIEW_DETAIL,
      PERMISSIONS.WAQF_CREATE,
      PERMISSIONS.WAQF_TRANSITION,
      PERMISSIONS.WAQF_DOCUMENTS_MANAGE,
    ],
    isActive: true,
  };

  const sampleCase = {
    id: '018faaaa-0000-7000-8000-777777777777',
    personId: '018faaaa-0000-7000-8000-000000000001',
    caseTitle: 'Wakaf Tanah Markaz Dakwah Bandung Barat',
    waqfType: 'tanah',
    currentStage: 'interested',
    estimatedValueRupiah: BigInt(1500000000),
    ownerUserId: waqfUser.id,
    openedAt: new Date(),
    updatedAt: new Date(),
  };

  it('Transitions waqf stage with 6-step transaction and history recording', async () => {
    const updatedCase = {
      ...sampleCase,
      currentStage: 'consulted',
    };

    const mockTx = {
      query: {
        waqfCases: {
          findFirst: vi.fn().mockResolvedValue(sampleCase),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: () => Promise.resolve([updatedCase]),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((data: any) => {
          if (table === waqfStageHistory || table?.name === 'waqf_stage_history' || table?._?.name === 'waqf_stage_history') {
            const row = { id: 'hist_1', ...data };
            return { returning: () => Promise.resolve([row]) };
          }
          if (table === auditLogs || table?.name === 'audit_logs' || table?._?.name === 'audit_logs') {
            return Promise.resolve();
          }
          if (table === tasks || table?.name === 'tasks' || table?._?.name === 'tasks') {
            const row = { id: 'task_waqf_1', ...data };
            return { returning: () => Promise.resolve([row]) };
          }
          return { returning: () => Promise.resolve([{ id: 'mock' }]) };
        }),
      })),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_waqf_transition',
      method: 'POST',
      path: `/api/waqf/${sampleCase.id}/transition`,
      headers: {},
      query: {},
      params: { id: sampleCase.id },
      body: {
        toStage: 'consulted',
        reason: 'Selesai konsultasi awal dan verifikasi lokasi tanah',
      },
      user: waqfUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.currentStage).toBe('consulted');
  });
});
