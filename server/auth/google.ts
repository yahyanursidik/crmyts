import crypto from 'node:crypto';
import { getServerEnv } from '../config/env';

/**
 * Google Identity Services (ID token) verification for the kajian rutin portal.
 *
 * The browser obtains a short-lived Google ID credential; this module verifies the
 * RS256 signature against Google's published JWKS and validates issuer, audience,
 * and expiry locally so every request stays inside the Netlify function.
 */

interface GoogleJwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
}

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const JWKS_CACHE_MS = 60 * 60 * 1000;

let jwksCache: { keys: GoogleJwk[]; fetchedAt: number } | null = null;

async function fetchGoogleJwks(): Promise<GoogleJwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_MS) {
    return jwksCache.keys;
  }
  const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Gagal mengambil sertifikat publik Google (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as { keys?: GoogleJwk[] };
  if (!payload.keys || payload.keys.length === 0) {
    throw new Error('Sertifikat publik Google kosong.');
  }
  jwksCache = { keys: payload.keys, fetchedAt: Date.now() };
  return payload.keys;
}

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

interface GoogleIdTokenPayload {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  exp?: number;
  nonce?: string;
}

export type GoogleTokenFailure =
  | 'CONFIG_MISSING'
  | 'MALFORMED'
  | 'UNKNOWN_KEY'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED'
  | 'INVALID_CLAIMS';

export type GoogleVerifyResult =
  | { ok: true; profile: GoogleProfile }
  | { ok: false; reason: GoogleTokenFailure; message: string };

export function isGoogleAuthConfigured(): boolean {
  return Boolean(getServerEnv().GOOGLE_CLIENT_ID);
}

/**
 * Verifies a Google ID token credential end-to-end. Returns a normalized profile
 * (sub, email, name, picture) when the token is trustworthy, otherwise a
 * structured failure so the route can answer with a precise message.
 */
export async function verifyGoogleIdToken(credential: string): Promise<GoogleVerifyResult> {
  const clientId = getServerEnv().GOOGLE_CLIENT_ID;
  if (!clientId) {
    return {
      ok: false,
      reason: 'CONFIG_MISSING',
      message: 'Login Google belum dikonfigurasi pada server (GOOGLE_CLIENT_ID kosong).',
    };
  }

  const parts = credential.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { ok: false, reason: 'MALFORMED', message: 'Kredensial Google tidak valid.' };
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: { alg?: string; kid?: string };
  let payload: GoogleIdTokenPayload;
  try {
    header = JSON.parse(base64UrlToBuffer(encodedHeader).toString('utf8'));
    payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString('utf8'));
  } catch {
    return { ok: false, reason: 'MALFORMED', message: 'Kredensial Google tidak dapat dibaca.' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { ok: false, reason: 'MALFORMED', message: 'Algoritma kredensial Google tidak didukung.' };
  }

  let jwk: GoogleJwk | undefined;
  try {
    const keys = await fetchGoogleJwks();
    jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
  } catch (error) {
    console.error('[Google JWKS Error]:', error);
    return { ok: false, reason: 'UNKNOWN_KEY', message: 'Sertifikat Google belum dapat diambil. Coba lagi.' };
  }
  if (!jwk) {
    jwksCache = null;
    return { ok: false, reason: 'UNKNOWN_KEY', message: 'Kunci Google tidak dikenal. Coba lagi.' };
  }

  try {
    const publicKey = crypto.createPublicKey({
      key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
      format: 'jwk',
    });
    const signatureOk = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      base64UrlToBuffer(encodedSignature)
    );
    if (!signatureOk) {
      return { ok: false, reason: 'INVALID_SIGNATURE', message: 'Tanda tangan kredensial Google tidak valid.' };
    }
  } catch (error) {
    console.error('[Google Signature Verify Error]:', error);
    return { ok: false, reason: 'INVALID_SIGNATURE', message: 'Tanda tangan kredensial Google gagal diverifikasi.' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < nowSeconds) {
    return { ok: false, reason: 'EXPIRED', message: 'Sesi Google sudah kedaluwarsa. Silakan login ulang.' };
  }

  const issuerOk = payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';
  if (!issuerOk || payload.aud !== clientId || !payload.sub) {
    return { ok: false, reason: 'INVALID_CLAIMS', message: 'Kredensial Google bukan untuk aplikasi ini.' };
  }
  if (!payload.email || payload.email_verified === false) {
    return { ok: false, reason: 'INVALID_CLAIMS', message: 'Email Google belum terverifikasi. Gunakan akun Google lain.' };
  }

  const email = payload.email.toLowerCase();
  return {
    ok: true,
    profile: {
      sub: payload.sub,
      email,
      name: payload.name?.trim() || email.split('@')[0] || 'Jamaah',
      picture: typeof payload.picture === 'string' && payload.picture.startsWith('https://') ? payload.picture : null,
    },
  };
}
