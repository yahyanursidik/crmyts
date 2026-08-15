import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDashboardRoutes } from '../../server/domain/dashboard/routes';
import * as client from '../../server/db/client';
import { ROLES } from '../../server/permissions/constants';

describe('Role-Specific Dashboards (Step 16 / M12)', () => {
  const router = new Router();
  registerDashboardRoutes(router);

  const testUser = {
    id: '018f9999-0000-7000-8000-000000000001',
    authSubject: 'sub_test',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Test Operator',
    roles: [ROLES.CRM_ADMIN],
    permissions: [],
    isActive: true,
  };

  const createQueryChain = (resolvedValue: any) => {
    const chain: any = {
      where: vi.fn().mockImplementation(() => chain),
      leftJoin: vi.fn().mockImplementation(() => chain),
      groupBy: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
      then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve),
    };
    return chain;
  };

  const mockDb = {
    select: vi.fn().mockImplementation(() => {
      return {
        from: vi.fn().mockImplementation(() => createQueryChain([{ count: 12, total: '50000000' }])),
      };
    }),
    query: {
      tasks: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'task_1',
            title: 'Sapa Jamaah Baru via WA',
            dueAt: new Date(Date.now() - 86400000 * 2), // 2 days overdue
            priority: 'high',
            person: { fullName: 'Ahmad Abdullah' },
          },
        ]),
      },
      donations: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      events: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };

  vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

  const rolesToTest = [
    { role: ROLES.CRM_ADMIN, expectedTitle: 'CRM Administrator' },
    { role: ROLES.DATA_STEWARD, expectedTitle: 'Data Steward & Quality' },
    { role: ROLES.CS_OFFICER, expectedTitle: 'Customer Service & Jamaah Care' },
    { role: ROLES.EVENT_ADMIN, expectedTitle: 'Admin Kajian & Dakwah' },
    { role: ROLES.FUNDRAISING_OFFICER, expectedTitle: 'Fundraising & Donor Care' },
    { role: ROLES.WAQF_OFFICER, expectedTitle: 'Waqf Pipeline & Stewardship' },
    { role: ROLES.FINANCE_VERIFIER, expectedTitle: 'Finance & Verification Officer' },
  ];

  for (const { role, expectedTitle } of rolesToTest) {
    it(`Generates 4-pillar dashboard data for role: ${role} (${expectedTitle})`, async () => {
      const res = await router.handle({
        requestId: `req_${role}`,
        method: 'GET',
        path: '/api/dashboard/role-view',
        headers: {},
        query: { role },
        params: {},
        body: {},
        user: testUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);

      // Pillar 1: Role Identification & KPIs
      expect(json.data.role).toBe(role);
      expect(json.data.roleName).toBe(expectedTitle);
      expect(json.data.roleKpis.length).toBeGreaterThan(0);

      // Pillar 2: Quick Actions
      expect(json.data.quickActions.length).toBeGreaterThan(0);
      expect(json.data.quickActions[0]).toHaveProperty('label');
      expect(json.data.quickActions[0]).toHaveProperty('href');

      // Pillar 3: Today & Overdue Items
      expect(json.data).toHaveProperty('todayItems');
      expect(json.data).toHaveProperty('overdueItems');

      // Pillar 4: Attention Items & Warnings
      expect(json.data).toHaveProperty('attentionItems');
    });
  }
});
