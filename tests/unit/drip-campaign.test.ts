import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAutomationRoutes } from '../../server/domain/automation/routes';
import { resetServerEnvCache } from '../../server/config/env';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Drip Email Campaign Endpoints', () => {
  const adminUser = {
    id: '018f9999-0000-7000-8000-111111111111',
    authSubject: 'sub_admin_drip',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Admin Drip Campaign',
    roles: [ROLES.CRM_ADMIN],
    permissions: Object.values(PERMISSIONS),
    isActive: true,
  };

  beforeEach(() => {
    vi.stubEnv('MAILKETING_BROADCAST_DAILY_LIMIT', '400');
    resetServerEnvCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetServerEnvCache();
  });

  it('successfully creates a new drip email campaign with valid UUID and logs audit event', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-333333333333',
              fullName: 'Jamaah Uji 1',
              email: 'jamaah1@example.com',
              gender: 'ikhwan',
              cityRegency: 'Kota Bandung',
              createdAt: new Date(),
              isActive: true,
            },
            {
              id: '018f9999-0000-7000-8000-444444444444',
              fullName: 'Jamaah Uji 2',
              email: 'jamaah2@example.com',
              gender: 'akhwat',
              cityRegency: 'Kabupaten Bandung Barat',
              createdAt: new Date(),
              isActive: true,
            },
          ]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const response = await router.handle({
      requestId: 'req_create_campaign_test',
      method: 'POST',
      path: '/api/automation/email-campaigns',
      headers: {},
      query: {},
      params: {},
      body: {
        title: 'Program Sapaan Ukhuwah Jamaah (Pekan 2)',
        subject: 'Bismillah, Salam Hangat & Sapaan Ukhuwah dari YTS',
        bodyHtml: '<p>Assalamu alaikum {{fullName}} di {{city}}</p>',
        dailyQuota: 50,
        totalDays: 14,
        filterGender: 'all',
      },
      user: adminUser,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.title).toBe('Program Sapaan Ukhuwah Jamaah (Pekan 2)');
    expect(body.data.stats.totalRecipients).toBe(2);

    // Verify campaign ID is a valid RFC 4122 UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(UUID_REGEX.test(body.data.id)).toBe(true);

    // Verify audit log insert was called
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('provides audience count preview for drip email campaigns', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            { id: '1', email: 'test1@example.com' },
            { id: '2', email: 'test2@example.com' },
          ]),
        },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const response = await router.handle({
      requestId: 'req_audience_preview',
      method: 'GET',
      path: '/api/automation/email-campaigns-audience-preview',
      headers: {},
      query: { gender: 'all' },
      params: {},
      body: {},
      user: adminUser,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.count).toBe(2);
  });

  it('sends single test email preview successfully when campaign exists', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-333333333333',
              fullName: 'Jamaah Uji 1',
              email: 'jamaah1@example.com',
              gender: 'ikhwan',
              cityRegency: 'Kota Bandung',
              createdAt: new Date(),
              isActive: true,
            },
          ]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    // 1. Create a campaign first
    const createRes = await router.handle({
      requestId: 'req_create_for_test_email',
      method: 'POST',
      path: '/api/automation/email-campaigns',
      headers: {},
      query: {},
      params: {},
      body: {
        title: 'Campaign Uji Test Email',
        subject: 'Bismillah, Subjek Uji',
        bodyHtml: '<p>Halo {{fullName}} di {{city}}</p>',
        dailyQuota: 30,
        totalDays: 7,
      },
      user: adminUser,
    });
    expect(createRes.statusCode).toBe(201);
    const campaignId = JSON.parse(createRes.body).data.id;

    // 2. Mock email sending
    const emailService = await import('../../server/email/service');
    const sendEmailSpy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue({
      success: true,
      messageId: 'yts-test-message-id',
    });

    // 3. Dispatch test email
    const testRes = await router.handle({
      requestId: 'req_send_test_email',
      method: 'POST',
      path: `/api/automation/email-campaigns/${campaignId}/test-email`,
      headers: {},
      query: {},
      params: { id: campaignId },
      body: {
        testEmail: 'tester@tarbiyahsunnah.id',
      },
      user: adminUser,
    });

    expect(testRes.statusCode).toBe(200);
    const testBody = JSON.parse(testRes.body);
    expect(testBody.data.message).toContain('tester@tarbiyahsunnah.id');
    expect(testBody.data.messageId).toBe('yts-test-message-id');

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'tester@tarbiyahsunnah.id',
        subject: '[PREVIEW TES] Bismillah, Subjek Uji',
      })
    );
  });

  it('returns 404 when sending test email for non-existent campaign', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        emailCampaigns: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const testRes = await router.handle({
      requestId: 'req_send_test_email_404',
      method: 'POST',
      path: '/api/automation/email-campaigns/non-existent-campaign-id/test-email',
      headers: {},
      query: {},
      params: { id: 'non-existent-campaign-id' },
      body: {
        testEmail: 'tester@tarbiyahsunnah.id',
      },
      user: adminUser,
    });

    expect(testRes.statusCode).toBe(404);
    const body = JSON.parse(testRes.body);
    expect(body.error).toBeDefined();
    expect(body.error.message).toContain('tidak ditemukan');
  });

  it('updates campaign details via PUT /api/automation/email-campaigns/:id', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-555555555555',
              fullName: 'Jamaah Uji 3',
              email: 'jamaah3@example.com',
              gender: 'ikhwan',
              cityRegency: 'Kota Cimahi',
              createdAt: new Date(),
              isActive: true,
            },
          ]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    // Create campaign
    const createRes = await router.handle({
      requestId: 'req_create_for_update',
      method: 'POST',
      path: '/api/automation/email-campaigns',
      headers: {},
      query: {},
      params: {},
      body: {
        title: 'Campaign Sebelum Update',
        subject: 'Subjek Awal',
        bodyHtml: '<p>Awal</p>',
        dailyQuota: 20,
        totalDays: 10,
      },
      user: adminUser,
    });
    const campaignId = JSON.parse(createRes.body).data.id;

    // Update campaign
    const updateRes = await router.handle({
      requestId: 'req_update_campaign',
      method: 'PUT',
      path: `/api/automation/email-campaigns/${campaignId}`,
      headers: {},
      query: {},
      params: { id: campaignId },
      body: {
        title: 'Campaign Sesudah Update',
        subject: 'Subjek Baru Terupdate',
        dailyQuota: 45,
      },
      user: adminUser,
    });

    expect(updateRes.statusCode).toBe(200);
    const updateBody = JSON.parse(updateRes.body);
    expect(updateBody.data.title).toBe('Campaign Sesudah Update');
    expect(updateBody.data.subject).toBe('Subjek Baru Terupdate');
    expect(updateBody.data.dailyQuota).toBe(45);
  });

  it('logs CRM outreach interaction and audit event via POST /api/automation/log-outreach', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f9999-0000-7000-8000-666666666666',
            fullName: 'Ahmad Jamaah CRM',
            phoneE164: '+6281234567890',
            email: 'ahmad@example.com',
          }),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-777777777777',
              personId: '018f9999-0000-7000-8000-666666666666',
              channel: 'whatsapp',
              summary: 'Outreach [kajian_reminder]: Pengingat Kajian Akbar',
            },
          ]),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_log_outreach_test',
      method: 'POST',
      path: '/api/automation/log-outreach',
      headers: {},
      query: {},
      params: {},
      body: {
        personId: '018f9999-0000-7000-8000-666666666666',
        channel: 'whatsapp',
        category: 'kajian_reminder',
        summary: 'Pengingat Kajian Akbar Masjid Tarbiyah Sunnah',
        outcome: 'Pesan dibuka oleh amil via WA Web',
      },
      user: adminUser,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeDefined();
    expect(body.data.personName).toBe('Ahmad Jamaah CRM');
    expect(body.data.interactionId).toBe('018f9999-0000-7000-8000-777777777777');
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('handles global email blacklist CRUD and auto-skips blacklisted emails on campaign creation', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-888888888888',
              fullName: 'Jamaah Ter-Blacklist',
              email: 'blacklist-test@example.com',
              gender: 'ikhwan',
              cityRegency: 'Kota Bandung',
              createdAt: new Date(),
              isActive: true,
            },
            {
              id: '018f9999-0000-7000-8000-999999999999',
              fullName: 'Jamaah Normal',
              email: 'normal-test@example.com',
              gender: 'akhwat',
              cityRegency: 'Kota Cimahi',
              createdAt: new Date(),
              isActive: true,
            },
          ]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    // 1. Add email to blacklist
    const addBlacklistRes = await router.handle({
      requestId: 'req_add_blacklist',
      method: 'POST',
      path: '/api/automation/email-blacklist',
      headers: {},
      query: {},
      params: {},
      body: {
        email: 'blacklist-test@example.com',
        reason: 'manual_blacklist',
        notes: 'Permintaan tidak ingin menerima email',
      },
      user: adminUser,
    });
    expect(addBlacklistRes.statusCode).toBe(201);
    const addedEntry = JSON.parse(addBlacklistRes.body).data;
    expect(addedEntry.email).toBe('blacklist-test@example.com');

    // 2. Fetch blacklist entries
    const listRes = await router.handle({
      requestId: 'req_list_blacklist',
      method: 'GET',
      path: '/api/automation/email-blacklist',
      headers: {},
      query: { search: 'blacklist-test' },
      params: {},
      body: {},
      user: adminUser,
    });
    expect(listRes.statusCode).toBe(200);
    const listData = JSON.parse(listRes.body).data;
    expect(listData.items.some((e: any) => e.email === 'blacklist-test@example.com')).toBe(true);
    expect(listData.stats.total).toBeGreaterThanOrEqual(1);

    // 3. Create campaign and verify the blacklisted recipient is marked as blacklisted
    const createRes = await router.handle({
      requestId: 'req_create_with_blacklist',
      method: 'POST',
      path: '/api/automation/email-campaigns',
      headers: {},
      query: {},
      params: {},
      body: {
        title: 'Kampanye dengan Blacklist Filter',
        subject: 'Uji Coba Filter Blacklist',
        bodyHtml: '<p>Halo {{fullName}}</p>',
        dailyQuota: 50,
        totalDays: 14,
      },
      user: adminUser,
    });
    expect(createRes.statusCode).toBe(201);
    const campaign = JSON.parse(createRes.body).data;
    const blacklistedRecip = campaign.recipients.find((r: any) => r.email === 'blacklist-test@example.com');
    const normalRecip = campaign.recipients.find((r: any) => r.email === 'normal-test@example.com');

    expect(blacklistedRecip).toBeDefined();
    expect(blacklistedRecip.status).toBe('blacklisted');
    expect(blacklistedRecip.error).toContain('Blacklist');

    expect(normalRecip).toBeDefined();
    expect(normalRecip.status).toBe('pending');

    expect(campaign.stats.totalBlacklisted).toBe(1);
    expect(campaign.stats.remaining).toBe(1);

    // 4. Delete from blacklist
    const deleteRes = await router.handle({
      requestId: 'req_delete_blacklist',
      method: 'DELETE',
      path: `/api/automation/email-blacklist/${addedEntry.id}`,
      headers: {},
      query: {},
      params: { id: addedEntry.id },
      body: {},
      user: adminUser,
    });
    expect(deleteRes.statusCode).toBe(200);
  });

  it('allows manual blacklisting and unblacklisting recipient directly within campaign', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-aaaa11112222',
              fullName: 'Jamaah Manual Toggle',
              email: 'toggle@example.com',
              gender: 'ikhwan',
              cityRegency: 'Kota Bandung',
              createdAt: new Date(),
              isActive: true,
            },
          ]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    // Create campaign
    const createRes = await router.handle({
      requestId: 'req_create_for_toggle',
      method: 'POST',
      path: '/api/automation/email-campaigns',
      headers: {},
      query: {},
      params: {},
      body: {
        title: 'Campaign Toggle Test',
        subject: 'Subjek',
        bodyHtml: '<p>Isi</p>',
        dailyQuota: 20,
        totalDays: 5,
      },
      user: adminUser,
    });
    const campaignId = JSON.parse(createRes.body).data.id;

    // Blacklist recipient
    const blRes = await router.handle({
      requestId: 'req_blacklist_recip',
      method: 'POST',
      path: `/api/automation/email-campaigns/${campaignId}/recipients/toggle%40example.com/blacklist`,
      headers: {},
      query: {},
      params: { id: campaignId, recipientEmail: 'toggle@example.com' },
      body: {},
      user: adminUser,
    });
    expect(blRes.statusCode).toBe(200);
    const blData = JSON.parse(blRes.body).data;
    expect(blData.recipient.status).toBe('blacklisted');
    expect(blData.campaign.stats.totalBlacklisted).toBe(1);

    // Unblacklist recipient
    const unblRes = await router.handle({
      requestId: 'req_unblacklist_recip',
      method: 'POST',
      path: `/api/automation/email-campaigns/${campaignId}/recipients/toggle%40example.com/unblacklist`,
      headers: {},
      query: {},
      params: { id: campaignId, recipientEmail: 'toggle@example.com' },
      body: {},
      user: adminUser,
    });
    expect(unblRes.statusCode).toBe(200);
    const unblData = JSON.parse(unblRes.body).data;
    expect(unblData.recipient.status).toBe('pending');
    expect(unblData.campaign.stats.totalBlacklisted).toBe(0);
  });

  it('auto-adds successfully dispatched recipients to blacklist with reason already_sent', async () => {
    const router = new Router();
    registerAutomationRoutes(router);

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-bbbb11112222',
              fullName: 'Jamaah Terkirim Auto Blacklist',
              email: 'autoblacklist@example.com',
              gender: 'ikhwan',
              cityRegency: 'Kota Bandung',
              createdAt: new Date(),
              isActive: true,
            },
          ]),
        },
        dailyBroadcastQuotaUsage: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-cccc11112222',
              usageDate: '2026-09-12',
              dispatchedCount: 1,
            },
          ]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: '018f9999-0000-7000-8000-cccc11112222',
                usageDate: '2026-09-12',
                dispatchedCount: 1,
              },
            ]),
          }),
        }),
      }),
      execute: vi.fn().mockResolvedValue([{ dispatch_count: 1 }]),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    // Mock email send
    const emailService = await import('../../server/email/service');
    vi.spyOn(emailService, 'sendEmail').mockResolvedValue({
      success: true,
      messageId: 'msg-auto-bl-1',
    });

    // Create campaign
    const createRes = await router.handle({
      requestId: 'req_create_for_auto_bl',
      method: 'POST',
      path: '/api/automation/email-campaigns',
      headers: {},
      query: {},
      params: {},
      body: {
        title: 'Campaign Auto Blacklist Test',
        subject: 'Subjek',
        bodyHtml: '<p>Isi</p>',
        dailyQuota: 10,
        totalDays: 5,
      },
      user: adminUser,
    });
    const campaignId = JSON.parse(createRes.body).data.id;

    // Dispatch today
    const dispatchRes = await router.handle({
      requestId: 'req_dispatch_auto_bl',
      method: 'POST',
      path: `/api/automation/email-campaigns/${campaignId}/dispatch-today`,
      headers: {},
      query: {},
      params: { id: campaignId },
      body: {},
      user: adminUser,
    });
    expect(dispatchRes.statusCode).toBe(200);
    const dispatchBody = JSON.parse(dispatchRes.body).data;
    expect(dispatchBody.successCount).toBe(1);

    // Check that autoblacklist@example.com is now in global blacklist
    const blListRes = await router.handle({
      requestId: 'req_check_auto_bl',
      method: 'GET',
      path: '/api/automation/email-blacklist',
      headers: {},
      query: { search: 'autoblacklist@example.com' },
      params: {},
      body: {},
      user: adminUser,
    });
    expect(blListRes.statusCode).toBe(200);
    const blListData = JSON.parse(blListRes.body).data;
    const entry = blListData.items.find((i: any) => i.email === 'autoblacklist@example.com');
    expect(entry).toBeDefined();
    expect(entry.reason).toBe('already_sent');
  });
});
