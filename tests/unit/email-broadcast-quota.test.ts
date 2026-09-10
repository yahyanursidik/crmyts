import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAutomationRoutes } from '../../server/domain/automation/routes';
import { resetServerEnvCache } from '../../server/config/env';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Mailketing broadcast daily limit', () => {
  const user = {
    id: '018f9999-0000-7000-8000-111111111111',
    authSubject: 'sub_broadcast_officer',
    email: 'broadcast@tarbiyahsunnah.id',
    fullName: 'Petugas Broadcast YTS',
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

  it('reports the server-side 400-email daily allowance in WIB', async () => {
    const router = new Router();
    registerAutomationRoutes(router);
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rows: [{ dispatch_count: 75 }] }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const response = await router.handle({
      requestId: 'req_broadcast_quota_status',
      method: 'GET',
      path: '/api/automation/email-broadcast-quota',
      headers: {},
      query: {},
      params: {},
      body: {},
      user,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data).toMatchObject({
      dailyLimit: 400,
      dispatchedToday: 75,
      remainingToday: 325,
    });
  });

  it('rejects a campaign dispatch after all 400 broadcast slots are used', async () => {
    const router = new Router();
    registerAutomationRoutes(router);
    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-222222222222',
              fullName: 'Jamaah Uji',
              email: 'jamaah@example.com',
              gender: 'ikhwan',
              cityRegency: 'Bandung',
              createdAt: new Date(),
            },
          ]),
        },
      },
      execute: vi.fn().mockResolvedValue({ rows: [{ dispatch_count: 400 }] }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const campaignsResponse = await router.handle({
      requestId: 'req_broadcast_campaign_seed',
      method: 'GET',
      path: '/api/automation/email-campaigns',
      headers: {},
      query: {},
      params: {},
      body: {},
      user,
    });
    const campaignId = JSON.parse(campaignsResponse.body).data[0].id;

    const response = await router.handle({
      requestId: 'req_broadcast_limit_reached',
      method: 'POST',
      path: `/api/automation/email-campaigns/${campaignId}/dispatch-today`,
      headers: {},
      query: {},
      params: { id: campaignId },
      body: {},
      user,
    });

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toContain('400 email');
  });
});
