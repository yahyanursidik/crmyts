import { describe, it, expect } from 'vitest';
import { Router } from '../../server/http/router';
import { requireAuth, requirePermission, RequestContext } from '../../server/http/middleware';
import { successResponse } from '../../server/http/response';
import { PERMISSIONS, ROLES, RoleCode } from '../../server/permissions/constants';

describe('API Permission Guard Matrix (Step 5)', () => {
  const router = new Router();

  // Test Route 1: General Auth Protected
  router.get(
    '/api/test/auth-only',
    requireAuth(async (ctx) => {
      return successResponse({ message: 'Auth success' }, { requestId: ctx.requestId });
    })
  );

  // Test Route 2: Financial Verification (Finance Only)
  router.post(
    '/api/test/donations/:id/verify',
    requireAuth(
      requirePermission(PERMISSIONS.DONATIONS_VERIFY, async (ctx) => {
        return successResponse({ verified: true, id: ctx.params.id }, { requestId: ctx.requestId });
      })
    )
  );

  // Test Route 3: System Configuration (Admin Only)
  router.post(
    '/api/test/system/configure',
    requireAuth(
      requirePermission(PERMISSIONS.SYSTEM_CONFIGURE, async (ctx) => {
        return successResponse({ configured: true }, { requestId: ctx.requestId });
      })
    )
  );

  const createMockContext = (
    method: string,
    path: string,
    user?: {
      id: string;
      authSubject: string;
      email: string;
      fullName: string;
      roles: RoleCode[];
      permissions: any[];
      isActive: boolean;
    }
  ): RequestContext => ({
    requestId: 'test_req_123',
    method,
    path,
    headers: {},
    query: {},
    body: {},
    params: {},
    user,
  });

  describe('Authentication Barrier', () => {
    it('should reject unauthenticated request with 401 UNAUTHENTICATED', async () => {
      const ctx = createMockContext('GET', '/api/test/auth-only');
      const res = await router.handle(ctx);

      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.body);
      expect(json.error?.code).toBe('UNAUTHENTICATED');
    });

    it('should reject inactive user with 403 FORBIDDEN', async () => {
      const ctx = createMockContext('GET', '/api/test/auth-only', {
        id: 'usr_inactive',
        authSubject: 'sub_inactive',
        email: 'inactive@tarbiyahsunnah.id',
        fullName: 'Inactive User',
        roles: [ROLES.CRM_ADMIN],
        permissions: [],
        isActive: false, // Inactive user
      });
      const res = await router.handle(ctx);

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.error?.code).toBe('FORBIDDEN');
    });
  });

  describe('Financial Permission Boundary (Anti-Fraud & Segregation of Duties)', () => {
    it('should REJECT Fundraising Officer trying to verify donation', async () => {
      const fundraisingUser = {
        id: 'usr_fundraiser',
        authSubject: 'sub_fundraiser',
        email: 'fundraiser@tarbiyahsunnah.id',
        fullName: 'Fundraising Officer',
        roles: [ROLES.FUNDRAISING_OFFICER], // Fundraising only
        permissions: [],
        isActive: true,
      };

      const ctx = createMockContext('POST', '/api/test/donations/don_123/verify', fundraisingUser);
      const res = await router.handle(ctx);

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.error?.code).toBe('FORBIDDEN');
      expect(json.error?.message).toContain('donations.verify');
    });

    it('should REJECT pure CRM Admin without Finance role (Segregation of Duties)', async () => {
      const pureAdminUser = {
        id: 'usr_admin',
        authSubject: 'sub_admin',
        email: 'admin@tarbiyahsunnah.id',
        fullName: 'Pure Admin',
        roles: [ROLES.CRM_ADMIN], // Pure admin without Finance role
        permissions: [],
        isActive: true,
      };

      const ctx = createMockContext('POST', '/api/test/donations/don_999/verify', pureAdminUser);
      const res = await router.handle(ctx);

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.error?.code).toBe('FORBIDDEN');
    });

    it('should ALLOW Finance Verifier to verify donation', async () => {
      const financeUser = {
        id: 'usr_finance',
        authSubject: 'sub_finance',
        email: 'finance@tarbiyahsunnah.id',
        fullName: 'Finance Verifier',
        roles: [ROLES.FINANCE_VERIFIER], // Finance Verifier
        permissions: [],
        isActive: true,
      };

      const ctx = createMockContext('POST', '/api/test/donations/don_123/verify', financeUser);
      const res = await router.handle(ctx);

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data?.verified).toBe(true);
      expect(json.data?.id).toBe('don_123');
    });
  });

  describe('Administrative Boundary', () => {
    it('should REJECT CS Officer trying to configure system', async () => {
      const csUser = {
        id: 'usr_cs',
        authSubject: 'sub_cs',
        email: 'cs@tarbiyahsunnah.id',
        fullName: 'CS Officer',
        roles: [ROLES.CS_OFFICER],
        permissions: [],
        isActive: true,
      };

      const ctx = createMockContext('POST', '/api/test/system/configure', csUser);
      const res = await router.handle(ctx);

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.error?.code).toBe('FORBIDDEN');
    });

    it('should ALLOW CRM Admin to configure system', async () => {
      const adminUser = {
        id: 'usr_admin',
        authSubject: 'sub_admin',
        email: 'admin@tarbiyahsunnah.id',
        fullName: 'CRM Admin',
        roles: [ROLES.CRM_ADMIN],
        permissions: [],
        isActive: true,
      };

      const ctx = createMockContext('POST', '/api/test/system/configure', adminUser);
      const res = await router.handle(ctx);

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data?.configured).toBe(true);
    });
  });
});
