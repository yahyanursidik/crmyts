import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAuthRoutes } from '../../server/auth/routes';
import * as authService from '../../server/auth/service';
import { ROLES } from '../../server/permissions/constants';

describe('Integration: Authentication & Session Token Resolution (CRM YTS)', () => {
  const router = new Router();
  registerAuthRoutes(router);

  it('Resolves active user session and returns authenticated context', async () => {
    const mockUser = {
      id: '018faaaa-0000-7000-8000-000000000001',
      authSubject: 'sub_test_admin',
      email: 'admin@tarbiyahsunnah.id',
      fullName: 'Super Admin',
      roles: [ROLES.CRM_ADMIN],
      permissions: ['dashboard.view', 'users.manage'],
      isActive: true,
    };

    vi.spyOn(authService, 'resolveUserBySubject').mockResolvedValue(mockUser as any);

    const res = await router.handle({
      requestId: 'req_auth_me',
      method: 'GET',
      path: '/api/auth/me',
      headers: { authorization: 'Bearer valid_mock_token' },
      query: {},
      params: {},
      body: {},
      user: mockUser as any,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.user.email).toBe('admin@tarbiyahsunnah.id');
    expect(json.data.user.roles).toContain(ROLES.CRM_ADMIN);
  });

  it('Rejects unauthenticated access with 401 UNAUTHENTICATED', async () => {
    const res = await router.handle({
      requestId: 'req_unauth',
      method: 'GET',
      path: '/api/auth/me',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: undefined,
    });

    expect(res.statusCode).toBe(401);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('UNAUTHENTICATED');
  });

  it('Rejects inactive / suspended user with 403 FORBIDDEN', async () => {
    const inactiveUser = {
      id: '018f9999-0000-7000-8000-000000000002',
      authSubject: 'sub_inactive',
      email: 'inactive@tarbiyahsunnah.id',
      fullName: 'Suspended User',
      roles: [ROLES.CS_OFFICER],
      permissions: [],
      isActive: false, // Inactive / suspended
    };

    const res = await router.handle({
      requestId: 'req_inactive',
      method: 'GET',
      path: '/api/auth/me',
      headers: { authorization: 'Bearer token_inactive' },
      query: {},
      params: {},
      body: {},
      user: inactiveUser as any,
    });

    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('FORBIDDEN');
  });
});
