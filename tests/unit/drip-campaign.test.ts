import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAutomationRoutes } from '../../server/domain/automation/routes';
import { resetServerEnvCache } from '../../server/config/env';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Drip Email Campaign Endpoints', () => {
  const adminUser = {
    id: '018f9999-0000-7000-8000-111111111111',
    authSubject: 'sub_admin_drip',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Admin Drip Campaign',
    roles: [ROLES.CRM_ADMIN],
    permissions: Object.values(PERMISSIONS),
    isActive: true,
  };

  beforeEach(() => {
    vi.stubEnv('MAILKETING_BROADCAST_DAILY_LIMIT', '400');
    resetServerEnvCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetServerEnvCache();
  });

  it('successfully creates a new drip email campaign with valid UUID and logs audit event', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-333333333333',
              fullName: 'Jamaah Uji 1',
              email: 'jamaah1@example.com',
              gender: 'ikhwan',
              cityRegency: 'Kota Bandung',
              createdAt: new Date(),
              isActive: true,
            },
            {
              id: '018f9999-0000-7000-8000-444444444444',
              fullName: 'Jamaah Uji 2',
              email: 'jamaah2@example.com',
              gender: 'akhwat',
              cityRegency: 'Kabupaten Bandung Barat',
              createdAt: new Date(),
              isActive: true,
            },
          ]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const response = await router.handle({
      requestId: 'req_create_campaign_test',
      method: 'POST',
      path: '/api/automation/email-campaigns',
      headers: {},
      query: {},
      params: {},
      body: {
        title: 'Program Sapaan Ukhuwah Jamaah (Pekan 2)',
        subject: 'Bismillah, Salam Hangat & Sapaan Ukhuwah dari YTS',
        bodyHtml: '<p>Assalamu alaikum {{fullName}} di {{city}}</p>',
        dailyQuota: 50,
        totalDays: 14,
        filterGender: 'all',
      },
      user: adminUser,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.title).toBe('Program Sapaan Ukhuwah Jamaah (Pekan 2)');
    expect(body.data.stats.totalRecipients).toBe(2);

    // Verify campaign ID is a valid RFC 4122 UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(UUID_REGEX.test(body.data.id)).toBe(true);

    // Verify audit log insert was called
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('provides audience count preview for drip email campaigns', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            { id: '1', email: 'test1@example.com' },
            { id: '2', email: 'test2@example.com' },
          ]),
        },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const response = await router.handle({
      requestId: 'req_audience_preview',
      method: 'GET',
      path: '/api/automation/email-campaigns-audience-preview',
      headers: {},
      query: { gender: 'all' },
      params: {},
      body: {},
      user: adminUser,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.count).toBe(2);
  });
});
