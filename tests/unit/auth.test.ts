import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../server/auth/password';
import { createSessionToken, verifySessionToken } from '../../server/auth/token';

describe('Authentication Core (Step 4 Auth Spike)', () => {
  describe('Password Hashing & Verification (scrypt)', () => {
    it('should hash and verify plain text password correctly', async () => {
      const password = 'AmanahLembaga#2026';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toContain(':');

      const isMatch = await verifyPassword(password, hash);
      expect(isMatch).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'CorrectPassword123';
      const hash = await hashPassword(password);

      const isMatch = await verifyPassword('WrongPassword999', hash);
      expect(isMatch).toBe(false);
    });

    it('should handle malformed hash strings safely without crashing', async () => {
      expect(await verifyPassword('test', 'not-a-valid-hash')).toBe(false);
      expect(await verifyPassword('test', '')).toBe(false);
      expect(await verifyPassword('test', 'salt-only:')).toBe(false);
    });
  });

  describe('Session Token Management (HMAC-SHA256)', () => {
    const mockUser = {
      userId: 'usr_uuid_123',
      authSubject: 'auth_sub_456',
      email: 'admin@tarbiyahsunnah.id',
    };

    it('should generate valid session token and decode payload', () => {
      const token = createSessionToken(mockUser, 3600);
      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(3);

      const result = verifySessionToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe(mockUser.userId);
      expect(result.payload?.authSubject).toBe(mockUser.authSubject);
      expect(result.payload?.email).toBe(mockUser.email);
    });

    it('should reject tampered token with invalid signature', () => {
      const token = createSessionToken(mockUser, 3600);
      const [header, payload, signature] = token.split('.');
      
      // Tamper signature
      const tamperedSignature = signature ? signature.slice(0, -2) + 'XX' : 'invalid';
      const tamperedToken = `${header}.${payload}.${tamperedSignature}`;

      const result = verifySessionToken(tamperedToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
    });

    it('should reject expired session token', () => {
      // Create token that expired 10 seconds ago
      const expiredToken = createSessionToken(mockUser, -10);

      const result = verifySessionToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EXPIRED');
    });

    it('should reject malformed tokens', () => {
      expect(verifySessionToken('invalid.token').valid).toBe(false);
      expect(verifySessionToken('').valid).toBe(false);
      expect(verifySessionToken('a.b.c.d').valid).toBe(false);
    });
  });
});
