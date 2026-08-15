import { describe, it, expect } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAuditRoutes } from '../../server/domain/audit/routes';
import { verifySessionToken } from '../../server/auth/token';

describe('Security: Role Spoofing & Token Tampering Prevention (CRM YTS)', () => {
  const router = new Router();
  registerAuditRoutes(router);

  it('Rejects forged / untrusted tokens with invalid signature', () => {
    const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdHRhY2tlciIsInJvbGVzIjpbImNybV9hZG1pbiJdfQ.INVALID_SIGNATURE';
    const result = verifySessionToken(forgedToken);
    expect(result.valid).toBe(false);
    expect(result.payload).toBeUndefined();
  });
});
