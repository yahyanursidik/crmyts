import { describe, it, expect } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDataQualityRoutes } from '../../server/domain/data-quality/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Security: IDOR (Insecure Direct Object Reference) Protection (CRM YTS)', () => {
  const router = new Router();
  registerDataQualityRoutes(router);

  const regularOperator = {
    id: '018f9999-0000-7000-8000-999999999999',
    authSubject: 'sub_operator',
    email: 'operator@tarbiyahsunnah.id',
    fullName: 'Regular Operator',
    roles: [ROLES.CS_OFFICER],
    permissions: [PERMISSIONS.INTERACTIONS_CREATE],
    isActive: true,
  };

  it('Blocks regular operator from executing administrative merge operation on arbitrary person IDs', async () => {
    const res = await router.handle({
      requestId: 'req_idor_merge',
      method: 'POST',
      path: '/api/data-quality/merge',
      headers: {},
      query: {},
      params: {},
      body: {
        primaryPersonId: '018faaaa-0000-7000-8000-000000000001',
        secondaryPersonId: '018fbbbb-0000-7000-8000-000000000002',
        reason: 'Attempted unauthorized merge',
      },
      user: regularOperator,
    });

    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('FORBIDDEN');
  });
});
