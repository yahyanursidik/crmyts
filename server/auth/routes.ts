import { z } from 'zod';
import { Router } from '../http/router';
import { validateBody, requireAuth } from '../http/middleware';
import { successResponse, errorResponse } from '../http/response';
import { loginUser, resolveUserBySubject } from './service';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password tidak boleh kosong'),
});

export function registerAuthRoutes(router: Router) {
  // 1. POST /api/auth/login
  router.post(
    '/api/auth/login',
    validateBody(loginSchema, async (ctx, body) => {
      try {
        const result = await loginUser(body.email, body.password);

        if (!result) {
          return errorResponse(
            'UNAUTHENTICATED',
            'Email atau kata sandi yang Anda masukkan salah.',
            401,
            ctx.requestId
          );
        }

        if (!result.user.isActive) {
          return errorResponse(
            'FORBIDDEN',
            'Akun Anda berstatus nonaktif. Silakan hubungi Administrator.',
            403,
            ctx.requestId
          );
        }

        return successResponse(result, { requestId: ctx.requestId });
      } catch (err: any) {
        console.error('[Login Error]:', err);
        return errorResponse(
          'INTERNAL_ERROR',
          'Terjadi gangguan saat memproses login.',
          500,
          ctx.requestId
        );
      }
    })
  );

  // 2. POST /api/auth/logout
  router.post('/api/auth/logout', async (ctx) => {
    return successResponse({ success: true }, { requestId: ctx.requestId });
  });

  // 3. GET /api/auth/me
  router.get(
    '/api/auth/me',
    requireAuth(async (ctx) => {
      try {
        if (!ctx.user) {
          return errorResponse('UNAUTHENTICATED', 'Sesi tidak valid.', 401, ctx.requestId);
        }

        const freshUser = await resolveUserBySubject(ctx.user.authSubject);

        if (!freshUser || !freshUser.isActive) {
          return errorResponse('FORBIDDEN', 'Akun tidak aktif.', 403, ctx.requestId);
        }

        return successResponse({ user: freshUser }, { requestId: ctx.requestId });
      } catch (err: any) {
        console.error('[Auth Me Error]:', err);
        return errorResponse('INTERNAL_ERROR', 'Gagal memuat profil pengguna.', 500, ctx.requestId);
      }
    })
  );
}
