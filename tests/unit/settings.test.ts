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

  it('4. GET /api/settings/ping returns database latency and operational status', async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_settings_ping',
      method: 'GET',
      path: '/api/settings/ping',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.status).toBe('healthy');
    expect(typeof json.data.databaseLatencyMs).toBe('number');
  });

  it('5. PATCH /api/settings/tags/:id/toggle toggles tag active status', async () => {
    const mockDb = {
      query: {
        tags: {
          findFirst: vi.fn().mockResolvedValue({ id: 'tag_1', name: 'Kajian Tafsir', isActive: true }),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'tag_1', name: 'Kajian Tafsir', isActive: false }]),
          }),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_settings_tag_toggle',
      method: 'PATCH',
      path: '/api/settings/tags/tag_1/toggle',
      headers: {},
      query: {},
      params: { id: 'tag_1' },
      body: {},
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.isActive).toBe(false);
  });

  it('6. DELETE /api/settings/tags/:id removes a tag', async () => {
    const mockDb = {
      query: {
        tags: {
          findFirst: vi.fn().mockResolvedValue({ id: 'tag_1', name: 'Kajian Tafsir' }),
        },
      },
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_settings_tag_del',
      method: 'DELETE',
      path: '/api/settings/tags/tag_1',
      headers: {},
      query: {},
      params: { id: 'tag_1' },
      body: {},
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.success).toBe(true);
  });

  it('7. DELETE /api/settings/programs/:id removes a donation program', async () => {
    const mockDb = {
      query: {
        donationPrograms: {
          findFirst: vi.fn().mockResolvedValue({ id: 'prog_1', name: 'Infaq Operasional', code: 'INFAQ_OP' }),
        },
      },
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit_1' }]),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_settings_prog_del',
      method: 'DELETE',
      path: '/api/settings/programs/prog_1',
      headers: {},
      query: {},
      params: { id: 'prog_1' },
      body: {},
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.success).toBe(true);
  });

  it('8. DELETE /api/settings/users/:id removes a staff user', async () => {
    const otherUserId = '018f9999-0000-7000-8000-222222222222';
    const mockDb = {
      query: {
        appUsers: {
          findFirst: vi.fn().mockResolvedValue({ id: otherUserId, fullName: 'Staf Amil', email: 'staf@yts.id' }),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit_1' }]),
        }),
      }),
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback({
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        });
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_settings_user_del',
      method: 'DELETE',
      path: `/api/settings/users/${otherUserId}`,
      headers: {},
      query: {},
      params: { id: otherUserId },
      body: {},
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.success).toBe(true);
  });
});

