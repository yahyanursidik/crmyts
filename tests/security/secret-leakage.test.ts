import { describe, it, expect } from 'vitest';
import { sanitizeAuditPayload } from '../../server/audit/service';

describe('Security: Database Secret & Token Leakage Prevention (CRM YTS)', () => {
  it('Sanitizes passwords, tokens, and API secrets from before_json and after_json payloads', () => {
    const rawPayload = {
      username: 'admin',
      password: 'super_secret_password_123',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz',
      apiKey: 'sk_live_secret_key_12345',
      sessionToken: 'jwt.token.here',
      userProfile: {
        fullName: 'Admin Tarbiyah',
        secretCode: '998877',
        email: 'admin@tarbiyahsunnah.id',
      },
    };

    const sanitized = sanitizeAuditPayload(rawPayload);

    expect(sanitized.username).toBe('admin');
    expect(sanitized.password).toBe('[REDACTED_SECRET]');
    expect(sanitized.passwordHash).toBe('[REDACTED_SECRET]');
    expect(sanitized.apiKey).toBe('[REDACTED_SECRET]');
    expect(sanitized.sessionToken).toBe('[REDACTED_SECRET]');
    expect(sanitized.userProfile.fullName).toBe('Admin Tarbiyah');
    expect(sanitized.userProfile.secretCode).toBe('[REDACTED_SECRET]');
    expect(sanitized.userProfile.email).toBe('admin@tarbiyahsunnah.id');
  });
});
