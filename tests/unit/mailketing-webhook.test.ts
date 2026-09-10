import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerWebhookRoutes } from '../../server/domain/webhooks/routes';
import { resetServerEnvCache } from '../../server/config/env';
import * as auditService from '../../server/audit/service';

describe('Mailketing webhook', () => {
  const router = new Router();
  registerWebhookRoutes(router);

  beforeEach(() => {
    vi.stubEnv('MAILKETING_WEBHOOK_SECRET', 'mailketing-webhook-secret-2026');
    resetServerEnvCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetServerEnvCache();
  });

  const request = (secret: string | undefined, body: unknown) => router.handle({
    requestId: 'req_mailketing_webhook',
    method: 'POST',
    path: '/api/webhooks/mailketing',
    headers: {},
    query: secret ? { secret } : {},
    params: {},
    body,
  });

  it('rejects requests without the application webhook secret', async () => {
    const response = await request(undefined, { type: 'emailopen', email: 'jamaah@example.com' });
    expect(response.statusCode).toBe(403);
  });

  it('records a validated Mailketing delivery event in the audit trail', async () => {
    const auditSpy = vi.spyOn(auditService, 'logAuditEvent').mockResolvedValue();
    const response = await request('mailketing-webhook-secret-2026', {
      type: 'bounce',
      email: 'jamaah@example.com',
      reason: 'User Unknown',
      date: '2026-08-18 10:20:00',
      message_id: 'yts-message-001',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data).toEqual({ received: true, type: 'bounce' });
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mailketing_webhook_bounce',
      entityType: 'mailketing_webhook',
      afterJson: expect.objectContaining({ email: 'jamaah@example.com', messageId: 'yts-message-001' }),
    }));
  });

  it('rejects malformed event payloads before they reach the audit trail', async () => {
    const auditSpy = vi.spyOn(auditService, 'logAuditEvent').mockResolvedValue();
    const response = await request('mailketing-webhook-secret-2026', {
      type: 'emailclick',
      email: 'not-an-email',
    });

    expect(response.statusCode).toBe(400);
    expect(auditSpy).not.toHaveBeenCalled();
  });
});
