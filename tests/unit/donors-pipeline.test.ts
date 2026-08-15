import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDonorsPipelineRoutes } from '../../server/domain/donors/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import { donorStageHistory, tasks } from '../../server/db/schema';

describe('Donor Lifecycle Pipeline & 7-Stage Progression (New Lead -> Loyal -> Dormant)', () => {
  const router = new Router();
  registerDonorsPipelineRoutes(router);

  const fundraisingStaff = {
    id: '018f1111-0000-7000-8000-111111111111',
    authSubject: 'sub_fundraising',
    email: 'fundraising@tarbiyahsunnah.id',
    fullName: 'Staf Penghimpunan Infaq',
    roles: [ROLES.FUNDRAISING_OFFICER],
    permissions: [
      PERMISSIONS.DONATIONS_LIST,
      PERMISSIONS.DONATIONS_CREATE,
      PERMISSIONS.DONATIONS_VERIFY,
    ],
    isActive: true,
  };

  it('GET /api/donors/pipeline returns 7 stage columns and conversion metrics', async () => {
    const mockPersons = [
      {
        id: '018f0000-0000-0000-0000-000000000001',
        fullName: 'Abdullah Baru',
        phoneE164: '+6281234567890',
        email: 'abdullah@example.com',
        donorStage: 'new_lead',
        isActive: true,
        updatedAt: new Date(),
        owner: { id: fundraisingStaff.id, fullName: fundraisingStaff.fullName, email: fundraisingStaff.email },
      },
      {
        id: '018f0000-0000-0000-0000-000000000002',
        fullName: 'Fulan Dorman',
        phoneE164: '+6281299998888',
        email: 'fulan@example.com',
        donorStage: 'dormant',
        isActive: true,
        updatedAt: new Date(),
        owner: null,
      },
    ];

    const mockDonationStats = [
      {
        personId: '018f0000-0000-0000-0000-000000000002',
        totalDonationsCount: 3,
        totalAmountRupiah: '1500000',
        lastDonationDate: new Date('2025-01-01T00:00:00Z'),
      },
    ];

    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue(mockPersons),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue(mockDonationStats),
          }),
        }),
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/donors/pipeline',
      method: 'GET',
      headers: {},
      query: {},
      params: {},
      body: null,
      user: fundraisingStaff,
      requestId: 'req_pipe_test_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.stages.length).toBe(7);
    expect(body.data.columns.new_lead.length).toBe(1);
    expect(body.data.columns.dormant.length).toBe(1);
    expect(body.data.metrics.totalPipelineDonors).toBe(2);
    expect(body.data.metrics.totalDonatedDonors).toBe(1);
  });

  it('POST /api/donors/:id/transition-stage records history and creates follow-up task', async () => {
    const mockPerson = {
      id: '018f0000-0000-0000-0000-000000000001',
      fullName: 'Ahmad Muzakki',
      donorStage: 'new_lead',
      phoneE164: '+6281111111111',
    };

    let insertedHistory: any = null;
    let insertedTask: any = null;

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(mockPerson),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...mockPerson, donorStage: 'contacted' }]),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((table) => {
        if (table === donorStageHistory) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedHistory = val;
              return Promise.resolve();
            }),
          };
        }
        if (table === tasks) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedTask = { ...val, id: 'tsk_new_123' };
              return {
                returning: vi.fn().mockResolvedValue([insertedTask]),
              };
            }),
          };
        }
        return {
          values: vi.fn().mockResolvedValue([]),
        };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/donors/018f0000-0000-0000-0000-000000000001/transition-stage',
      method: 'POST',
      headers: {},
      query: {},
      params: { id: '018f0000-0000-0000-0000-000000000001' },
      body: {
        targetStage: 'contacted',
        reason: 'Telah ditelepon oleh staf CS dan dikirimkan proposal infaq',
        createTask: true,
        taskDueDays: 3,
      },
      user: fundraisingStaff,
      requestId: 'req_transition_test_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.fromStage).toBe('new_lead');
    expect(body.data.toStage).toBe('contacted');
    expect(insertedHistory).not.toBeNull();
    expect(insertedHistory.toStage).toBe('contacted');
    expect(insertedTask).not.toBeNull();
  });

  it('POST /api/donors/:id/re-engage generates courteous Islamic greeting with wa.me link', async () => {
    const mockPerson = {
      id: '018f0000-0000-0000-0000-000000000099',
      fullName: 'Haji Bambang',
      donorStage: 'dormant',
      phoneE164: '+6281312345678',
    };

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(mockPerson),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'tsk_reengage_99' }]),
        }),
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/donors/018f0000-0000-0000-0000-000000000099/re-engage',
      method: 'POST',
      headers: {},
      query: {},
      params: { id: '018f0000-0000-0000-0000-000000000099' },
      body: {
        programFocus: 'Infaq Operasional Dakwah Tarbiyah Sunnah',
        notes: 'Silaturahmi dan penyampaian laporan penyaluran.',
      },
      user: fundraisingStaff,
      requestId: 'req_reengage_test_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.fullName).toBe('Haji Bambang');
    expect(body.data.message).toContain('Assalamu\'alaikum Warahmatullahi Wabarakatuh');
    expect(body.data.message).toContain('Haji Bambang');
    expect(body.data.message).toContain('Yayasan Tarbiyah Sunnah');
    expect(body.data.waDirectUrl).toContain('https://wa.me/6281312345678');
  });
});
