import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerSettingsRoutes } from '../../server/domain/settings/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import * as client from '../../server/db/client';

describe('Settings & Master Data Domain (Step 33 / Settings)', () => {
  const router = new Router();
  registerSettingsRoutes(router);

  const adminUser = {
    id: '018f9999-0000-7000-8000-111111111111',
    authSubject: 'sub_admin_settings',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Super Admin CRM',
    roles: [ROLES.CRM_ADMIN],
    permissions: Object.values(PERMISSIONS),
    isActive: true,
  };

  it('1. GET /api/settings/profile returns current user profile and roles', async () => {
    const res = await router.handle({
      requestId: 'req_settings_prof',
      method: 'GET',
      path: '/api/settings/profile',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.email).toBe(adminUser.email);
    expect(json.data.fullName).toBe(adminUser.fullName);
  });

  it('2. GET /api/settings/foundation returns organization legal & bank details', async () => {
    const res = await router.handle({
      requestId: 'req_settings_found',
      method: 'GET',
      path: '/api/settings/foundation',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.foundationName).toBe('Yayasan Tarbiyah Sunnah');
    expect(json.data.bankAccounts.length).toBeGreaterThan(0);
  });

  it('3. GET /api/settings/system-health returns serverless database and storage status', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ count: 1250 }]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_settings_health',
      method: 'GET',
      path: '/api/settings/system-health',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.database.engine).toContain('Neon Serverless');
    expect(json.data.storage.provider).toBeDefined();
  });
});
