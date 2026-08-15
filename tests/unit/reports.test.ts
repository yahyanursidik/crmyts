import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerReportsRoutes } from '../../server/domain/reports/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import * as client from '../../server/db/client';

describe('Reports & Import/Export Hub (Step 34 / M13 & M14)', () => {
  const router = new Router();
  registerReportsRoutes(router);

  const executiveUser = {
    id: '018f8888-0000-7000-8000-111111111111',
    authSubject: 'sub_exec_reports',
    email: 'pimpinan@tarbiyahsunnah.id',
    fullName: 'Ketua Yayasan Tarbiyah Sunnah',
    roles: [ROLES.LEADERSHIP_VIEWER, ROLES.CRM_ADMIN],
    permissions: Object.values(PERMISSIONS),
    isActive: true,
  };

  const createQueryChain = (resolvedValue: any) => {
    const chain: any = {
      where: vi.fn().mockImplementation(() => chain),
      leftJoin: vi.fn().mockImplementation(() => chain),
      groupBy: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
      offset: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
      then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve),
    };
    return chain;
  };

  it('1. GET /api/reports/executive-monthly calculates multi-module aggregate metrics', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(
          createQueryChain([
            {
              totalRupiah: '50000000',
              count: 25,
              totalAttendees: 150,
              uniquePersons: 120,
              totalEstimatedRupiah: '2500000000',
              activeCasesCount: 3,
              totalTasks: 10,
              completedTasks: 8,
              overdueTasks: 1,
            },
          ])
        ),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_rep_exec',
      method: 'GET',
      path: '/api/reports/executive-monthly',
      headers: {},
      query: { month: '2026-08' },
      params: {},
      body: {},
      user: executiveUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.summary).toBeDefined();
    expect(json.data.programBreakdown).toBeDefined();
  });

  it('2. POST /api/reports/import-csv/dry-run validates phone normalization and duplicates', async () => {
    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            { phoneE164: '+6281234567890', email: 'existing@example.com' },
          ]),
        },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_rep_dry_run',
      method: 'POST',
      path: '/api/reports/import-csv/dry-run',
      headers: {},
      query: {},
      params: {},
      body: {
        rows: [
          { fullName: 'Ahmad Baru', phone: '081299998888', cityRegency: 'Bandung', gender: 'ikhwan' },
          { fullName: 'Duplikat Kontak', phone: '081234567890', email: 'existing@example.com' },
          { fullName: 'Nomor Rusak', phone: '123' },
        ],
      },
      user: executiveUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.totalRows).toBe(3);
    expect(json.data.validCount).toBe(1);
    expect(json.data.duplicateCount).toBe(1);
    expect(json.data.errorCount).toBe(2);
  });
});
