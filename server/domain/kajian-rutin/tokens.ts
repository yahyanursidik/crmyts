import crypto from 'node:crypto';
import { getServerEnv } from '../../config/env';

/**
 * Sesi login jamaah portal kajian rutin. Terpisah dari token CRM admin agar
 * hak akses jamaah tidak pernah bisa tercampur dengan panel internal.
 */

export interface JamaahPortalTokenPayload {
  kind: 'kajian_rutin_portal';
  accountId: string;
  sub: string;
  email: string;
  name: string;
  exp: number;
  iat: number;
}

const PORTAL_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 hari

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function sign(data: string): string {
  return crypto
    .createHmac('sha256', getServerEnv().AUTH_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createJamaahPortalToken(input: { accountId: string; sub: string; email: string; name: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JamaahPortalTokenPayload = {
    kind: 'kajian_rutin_portal',
    accountId: input.accountId,
    sub: input.sub,
    email: input.email,
    name: input.name,
    iat: now,
    exp: now + PORTAL_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `kajian-rutin-portal.${encodedPayload}`;
  return `${data}.${sign(data)}`;
}

export type JamaahPortalVerifyResult =
  | { valid: true; payload: JamaahPortalTokenPayload }
  | { valid: false };

export function verifyJamaahPortalToken(token: string | null | undefined): JamaahPortalVerifyResult {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false };
  const [prefix, encodedPayload, signature] = parts;
  if (prefix !== 'kajian-rutin-portal' || !encodedPayload || !signature) return { valid: false };

  const data = `${prefix}.${encodedPayload}`;
  const expected = sign(data);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as JamaahPortalTokenPayload;
    if (payload.kind !== 'kajian_rutin_portal' || !payload.accountId || !payload.sub) return { valid: false };
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return { valid: false };
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export function extractJamaahPortalToken(headers: Record<string, string | undefined>): string | null {
  const auth = headers['authorization'] || headers['Authorization'];
  if (auth && auth.startsWith('Bearer ')) return auth.substring(7).trim();
  return null;
}

export function resolveJamaahSession(headers: Record<string, string | undefined>): JamaahPortalTokenPayload | null {
  const result = verifyJamaahPortalToken(extractJamaahPortalToken(headers));
  return result.valid ? result.payload : null;
}

export function generateQrToken(): string {
  return crypto.randomBytes(16).toString('hex');
}
