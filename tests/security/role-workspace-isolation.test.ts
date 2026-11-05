import { describe, it, expect, vi, afterEach } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDashboardRoutes } from '../../server/domain/dashboard/routes';
import { registerTasksRoutes } from '../../server/domain/tasks/routes';
import { registerPersonsRoutes } from '../../server/domain/persons/routes';
import { ROLE_PERMISSIONS, ROLES, type RoleCode } from '../../server/permissions/constants';
import * as client from '../../server/db/client';
import { PgDialect } from 'drizzle-orm/pg-core';

const user = (role: RoleCode) => ({ id: '018f0000-0000-7000-8000-000000000001', authSubject: 'sub-test', email: 'staff@yts.test', fullName: 'Staf Test', isActive: true, roles: [role], permissions: [...ROLE_PERMISSIONS[role]] });
const ctx = (role: RoleCode, path: string, method = 'GET', body: unknown = {}) => ({ requestId: 'test-access', method, path, headers: {}, params: {}, query: {}, body, user: user(role) });
afterEach(() => vi.restoreAllMocks());

describe('Server role and ownership isolation', () => {
  it('rejects unassigned dashboard roles before accessing the database', async () => {
    const router = new Router(); registerDashboardRoutes(router); const getDb = vi.spyOn(client, 'getDb');
    const result = await router.handle({ ...ctx(ROLES.CS_OFFICER, '/api/dashboard/role-view'), query: { role: ROLES.FINANCE_VERIFIER } });
    expect(result.statusCode).toBe(403); expect(getDb).not.toHaveBeenCalled();
  });
  it('rejects unknown roles and protects organizational financial statistics', async () => {
    const router = new Router(); registerDashboardRoutes(router);
    expect((await router.handle({ ...ctx(ROLES.CRM_ADMIN, '/api/dashboard/role-view'), query: { role: 'unknown' } })).statusCode).toBe(400);
    expect((await router.handle(ctx(ROLES.CS_OFFICER, '/api/dashboard/stats'))).statusCode).toBe(403);
  });
  it('scopes staff task lists to the owner even when another owner is requested', async () => {
    const router = new Router(); registerTasksRoutes(router);
    const findMany = vi.fn().mockResolvedValue([]); vi.spyOn(client, 'getDb').mockReturnValue({ query: { tasks: { findMany } }, select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }) }) } as any);
    const result = await router.handle({ ...ctx(ROLES.CS_OFFICER, '/api/tasks'), query: { ownerUserId: '018f0000-0000-7000-8000-000000000002' } });
    expect(result.statusCode).toBe(200);
    const query = new PgDialect().sqlToQuery(findMany.mock.calls[0]![0].where);
    expect(query.params).toContain(user(ROLES.CS_OFFICER).id); expect(query.sql).toContain('owner_user_id');
  });
  it('does not allow staff to delegate tasks or leadership to create them', async () => {
    const router = new Router(); registerTasksRoutes(router); vi.spyOn(client, 'getDb').mockReturnValue({} as any);
    const body = { title: 'Tindak lanjut jamaah', dueAt: new Date().toISOString(), ownerUserId: '018f0000-0000-7000-8000-000000000002' };
    expect((await router.handle(ctx(ROLES.CS_OFFICER, '/api/tasks', 'POST', body))).statusCode).toBe(403);
    expect((await router.handle(ctx(ROLES.LEADERSHIP_VIEWER, '/api/tasks', 'POST', body))).statusCode).toBe(403);
  });
  it('blocks personal profiles and directories from broadcast-only staff', async () => {
    const router = new Router(); registerPersonsRoutes(router);
    expect((await router.handle(ctx(ROLES.BROADCAST_OFFICER, '/api/persons'))).statusCode).toBe(403);
    expect((await router.handle(ctx(ROLES.BROADCAST_OFFICER, '/api/persons/018f0000-0000-7000-8000-000000000002'))).statusCode).toBe(403);
  });
});
