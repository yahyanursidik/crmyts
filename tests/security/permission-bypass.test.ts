import { describe, it, expect } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDataQualityRoutes } from '../../server/domain/data-quality/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Security: Permission Bypass Prevention (CRM YTS)', () => {
  const router = new Router();
  registerDataQualityRoutes(router);

  const csUserWithoutMergePerm = {
    id: '018f5555-0000-7000-8000-333333333333',
    authSubject: 'sub_cs',
    email: 'cs@tarbiyahsunnah.id',
    fullName: 'CS Staff',
    roles: [ROLES.CS_OFFICER], // CS Officer cannot manage data quality / merge
    permissions: [PERMISSIONS.INTERACTIONS_CREATE],
    isActive: true,
  };

  it('Blocks unauthorized role from triggering data quality anomaly scan with 403 FORBIDDEN', async () => {
    const res = await router.handle({
      requestId: 'req_bypass_attempt',
      method: 'GET',
      path: '/api/data-quality/anomalies',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: csUserWithoutMergePerm,
    });

    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toContain('data_quality.manage');
  });
});
