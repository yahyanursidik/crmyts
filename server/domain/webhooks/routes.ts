import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { logAuditEvent } from '../../audit/service';
import { getServerEnv } from '../../config/env';
import { Router } from '../../http/router';
import { errorResponse, successResponse } from '../../http/response';

const mailketingWebhookSchema = z.object({
  type: z.enum(['emailopen', 'emailclick', 'bounce', 'newsubscriber', 'unsubscribe']),
  email: z.string().email(),
  date: z.string().max(64).optional(),
  message_id: z.string().max(255).optional(),
  link_clicked: z.string().url().max(2_048).optional(),
  reason: z.string().max(1_000).optional(),
  first_name: z.string().max(255).optional(),
  last_name: z.string().max(255).optional(),
  list_id: z.string().max(255).optional(),
}).superRefine((payload, ctx) => {
  if (payload.type === 'emailclick' && !payload.link_clicked) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['link_clicked'], message: 'link_clicked wajib untuk event emailclick.' });
  }
  if (payload.type === 'bounce' && !payload.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'reason wajib untuk event bounce.' });
  }
});

function hasValidSecret(provided: string | undefined, expected: string): boolean {
  if (!provided || expected.length < 16) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Inbound delivery/open/click events from Mailketing.
 *
 * Mailketing currently posts JSON payloads without a documented signature. The
 * URL must therefore be configured with ?secret=<MAILKETING_WEBHOOK_SECRET>.
 */
export function registerWebhookRoutes(router: Router) {
  router.post('/api/webhooks/mailketing', async (ctx) => {
    const env = getServerEnv();
    const suppliedSecret = ctx.query.secret || ctx.headers['x-mailketing-webhook-secret'] || ctx.headers['X-Mailketing-Webhook-Secret'];

    if (!env.MAILKETING_WEBHOOK_SECRET) {
      return errorResponse('INTERNAL_ERROR', 'Webhook Mailketing belum dikonfigurasi.', 503, ctx.requestId);
    }
    if (!hasValidSecret(suppliedSecret, env.MAILKETING_WEBHOOK_SECRET)) {
      return errorResponse('FORBIDDEN', 'Webhook tidak diizinkan.', 403, ctx.requestId);
    }

    const parsed = mailketingWebhookSchema.safeParse(ctx.body);
    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Payload webhook Mailketing tidak valid.', 400, ctx.requestId, parsed.error.format());
    }

    const payload = parsed.data;
    await logAuditEvent({
      action: `mailketing_webhook_${payload.type}`,
      entityType: 'mailketing_webhook',
      afterJson: {
        provider: 'mailketing',
        type: payload.type,
        email: payload.email,
        occurredAt: payload.date || null,
        messageId: payload.message_id || null,
        linkClicked: payload.link_clicked || null,
        reason: payload.reason || null,
        listId: payload.list_id || null,
      },
      reason: `Webhook Mailketing: ${payload.type}`,
      requestId: ctx.requestId,
    });

    return successResponse({ received: true, type: payload.type }, { requestId: ctx.requestId });
  });
}
