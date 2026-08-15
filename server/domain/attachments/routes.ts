import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { defaultAttachmentService } from '../../storage/service';
import { SensitivityLevel } from '../../storage/types';

const uploadAttachmentSchema = z.object({
  originalFilename: z.string().min(1, 'Nama berkas asli wajib diisi'),
  mimeType: z.string().min(1, 'Tipe MIME berkas wajib diisi'),
  base64Data: z.string().min(1, 'Data berkas (Base64) wajib disertakan'),
  sensitivityLevel: z.enum(['standard', 'confidential', 'restricted']).default('standard'),
  purpose: z.string().optional().nullable(),
});

const deleteAttachmentSchema = z.object({
  reason: z.string().optional().nullable(),
});

export function registerAttachmentsRoutes(router: Router) {
  // POST /api/attachments/upload (Upload Private Attachment)
  router.post(
    '/api/attachments/upload',
    requireAuth(
      validateBody(uploadAttachmentSchema, async (ctx, body) => {
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        try {
          // Decode Base64
          const base64Clean = body.base64Data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
          const buffer = Buffer.from(base64Clean, 'base64');

          const result = await defaultAttachmentService.upload({
            originalFilename: body.originalFilename,
            mimeType: body.mimeType,
            buffer,
            fileSizeBytes: buffer.length,
            sensitivityLevel: body.sensitivityLevel as SensitivityLevel,
            uploadedByUserId: user.id,
            purpose: body.purpose || 'general_attachment',
            requestId: ctx.requestId,
          });

          return successResponse(result, { requestId: ctx.requestId }, 201);
        } catch (err: any) {
          return errorResponse('VALIDATION_ERROR', err.message || 'Gagal mengunggah berkas', 422, ctx.requestId);
        }
      })
    )
  );

  // GET /api/attachments/:id/url (Get Private Signed Temporary URL)
  router.get(
    '/api/attachments/:id/url',
    requireAuth(async (ctx) => {
      const user = ctx.user;
      if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

      const attachmentId = ctx.params.id;
      if (!attachmentId) {
        return errorResponse('VALIDATION_ERROR', 'ID Lampiran diperlukan', 400, ctx.requestId);
      }

      const expiresInSeconds = ctx.query.expiresInSeconds ? parseInt(ctx.query.expiresInSeconds, 10) : 900;

      try {
        const result = await defaultAttachmentService.getTemporaryUrl(attachmentId, {
          requestingUserId: user.id,
          expiresInSeconds,
          requestId: ctx.requestId,
        });

        return successResponse(result, { requestId: ctx.requestId });
      } catch (err: any) {
        return errorResponse('NOT_FOUND', err.message || 'Berkas tidak ditemukan', 404, ctx.requestId);
      }
    })
  );

  // GET /api/attachments/:id/metadata
  router.get(
    '/api/attachments/:id/metadata',
    requireAuth(async (ctx) => {
      const attachmentId = ctx.params.id;
      if (!attachmentId) {
        return errorResponse('VALIDATION_ERROR', 'ID Lampiran diperlukan', 400, ctx.requestId);
      }

      const metadata = await defaultAttachmentService.getMetadata(attachmentId);
      if (!metadata) {
        return errorResponse('NOT_FOUND', 'Metadata berkas tidak ditemukan', 404, ctx.requestId);
      }

      return successResponse(metadata, { requestId: ctx.requestId });
    })
  );

  // DELETE /api/attachments/:id (Soft Delete Attachment)
  router.delete(
    '/api/attachments/:id',
    requireAuth(
      validateBody(deleteAttachmentSchema, async (ctx, body) => {
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const attachmentId = ctx.params.id;
        if (!attachmentId) {
          return errorResponse('VALIDATION_ERROR', 'ID Lampiran diperlukan', 400, ctx.requestId);
        }

        try {
          await defaultAttachmentService.softDelete(attachmentId, {
            requestingUserId: user.id,
            reason: body.reason || 'Penghapusan berkas lampiran privat',
            requestId: ctx.requestId,
          });

          return successResponse({ deleted: true, attachmentId }, { requestId: ctx.requestId });
        } catch (err: any) {
          return errorResponse('NOT_FOUND', err.message || 'Gagal menghapus berkas', 404, ctx.requestId);
        }
      })
    )
  );
}
