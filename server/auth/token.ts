import crypto from 'crypto';
import { getServerEnv } from '../config/env';

export interface SessionTokenPayload {
  userId: string;
  authSubject: string;
  email: string;
  exp: number; // Unix timestamp in seconds
  iat: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Creates a signed session token with HMAC-SHA256
 */
export function createSessionToken(
  payload: Omit<SessionTokenPayload, 'exp' | 'iat'>,
  expiresInSeconds = 86400 * 7 // Default 7 days
): string {
  const env = getServerEnv();
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: SessionTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', env.AUTH_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

export interface VerifyTokenResult {
  valid: boolean;
  payload?: SessionTokenPayload;
  error?: 'MALFORMED' | 'INVALID_SIGNATURE' | 'EXPIRED';
}

/**
 * Verifies a session token signature and expiration
 */
export function verifySessionToken(token: string): VerifyTokenResult {
  try {
    const env = getServerEnv();
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'MALFORMED' };
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    if (!encodedHeader || !encodedPayload || !signature) {
      return { valid: false, error: 'MALFORMED' };
    }

    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.AUTH_SECRET)
      .update(dataToSign)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // Timing-safe signature check
    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: SessionTokenPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'EXPIRED' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'MALFORMED' };
  }
}
