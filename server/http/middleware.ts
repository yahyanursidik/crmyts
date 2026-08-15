import { z } from 'zod';
import { errorResponse, HttpResponse } from './response';
import { PermissionCode, RoleCode, hasPermission } from '../permissions/constants';
import { verifySessionToken } from '../auth/token';

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: unknown;
  params: Record<string, string>;
  user?: {
    id: string;
    authSubject: string;
    email: string;
    fullName: string;
    roles: RoleCode[];
    permissions: PermissionCode[];
    isActive: boolean;
  };
}

export type Handler = (ctx: RequestContext) => Promise<HttpResponse>;

/**
 * Generate or retrieve correlation request ID
 */
export function extractRequestId(headers: Record<string, string | undefined>): string {
  return headers['x-request-id'] || headers['X-Request-ID'] || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(headers: Record<string, string | undefined>): string | null {
  const auth = headers['authorization'] || headers['Authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return auth.substring(7).trim();
  }
  return null;
}

/**
 * Validates token and resolves basic session claims
 */
export function resolveTokenClaims(headers: Record<string, string | undefined>) {
  const token = extractBearerToken(headers);
  if (!token) return null;

  const result = verifySessionToken(token);
  if (!result.valid || !result.payload) return null;

  return result.payload;
}

/**
 * Guard middleware requiring authentication
 */
export function requireAuth(handler: Handler): Handler {
  return async (ctx: RequestContext) => {
    if (!ctx.user) {
      return errorResponse('UNAUTHENTICATED', 'Sesi tidak valid atau telah berakhir. Silakan login kembali.', 401, ctx.requestId);
    }
    if (!ctx.user.isActive) {
      return errorResponse('FORBIDDEN', 'Akun Anda berstatus nonaktif. Hubungi Administrator.', 403, ctx.requestId);
    }
    return handler(ctx);
  };
}

/**
 * Guard middleware requiring specific permission
 */
export function requirePermission(permission: PermissionCode, handler: Handler): Handler {
  return async (ctx: RequestContext) => {
    if (!ctx.user) {
      return errorResponse('UNAUTHENTICATED', 'Otentikasi diperlukan.', 401, ctx.requestId);
    }
    if (!ctx.user.isActive) {
      return errorResponse('FORBIDDEN', 'Akun Anda berstatus nonaktif. Hubungi Administrator.', 403, ctx.requestId);
    }
    if (!hasPermission(ctx.user.roles, permission)) {
      return errorResponse('FORBIDDEN', `Akses ditolak. Anda tidak memiliki izin [${permission}].`, 403, ctx.requestId);
    }
    return handler(ctx);
  };
}

/**
 * Zod validation helper for request body
 */
export function validateBody<T>(schema: z.ZodSchema<T>, handler: (ctx: RequestContext, validBody: T) => Promise<HttpResponse>): Handler {
  return async (ctx: RequestContext) => {
    const result = schema.safeParse(ctx.body);
    if (!result.success) {
      return errorResponse('VALIDATION_ERROR', 'Format data tidak valid.', 400, ctx.requestId, result.error.format());
    }
    return handler(ctx, result.data);
  };
}
