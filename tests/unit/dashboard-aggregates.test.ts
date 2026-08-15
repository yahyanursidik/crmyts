import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDashboardRoutes } from '../../server/domain/dashboard/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Dashboard Pimpinan / Executive Analytics (Step 15 / M11)', () => {
  const router = new Router();
  registerDashboardRoutes(router);

  const leadershipUser = {
    id: '018f8888-0000-7000-8000-999999999999',
    authSubject: 'sub_pimpinan',
    email: 'pimpinan@tarbiyahsunnah.id',
    fullName: 'Ketua Yayasan',
    roles: [ROLES.LEADERSHIP_VIEWER],
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.PERSONS_VIEW_SUMMARY,
      PERMISSIONS.DONATIONS_VIEW_SUMMARY,
      PERMISSIONS.WAQF_VIEW_SUMMARY,
    ],
    isActive: true,
  };

  it('Returns 10 core KPIs and 5 aggregated chart datasets via server-side SQL', async () => {
    const createQueryChain = (resolvedValue: any) => {
      const chain: any = {
        where: vi.fn().mockImplementation(() => chain),
        leftJoin: vi.fn().mockImplementation(() => chain),
        groupBy: vi.fn().mockImplementation(() => chain),
        orderBy: vi.fn().mockImplementation(() => chain),
        limit: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
        then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve),
      };
      return chain;
    };

    let selectCallCount = 0;

    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockImplementation(() => {
            if (selectCallCount <= 5) {
              return createQueryChain([{ count: 42 }]);
            }
            if (selectCallCount === 6) {
              return createQueryChain([{ total: '150000000' }]);
            }
            if (selectCallCount <= 10) {
              return createQueryChain([{ count: 5 }]);
            }
            if (selectCallCount === 11) {
              // Attendance Trend
              return createQueryChain([
                {
                  eventId: 'ev_1',
                  eventTitle: 'Kajian Riyadhus Shalihin',
                  eventDate: new Date(),
                  speaker: 'Ustadz Abu Haidar',
                  attendeeCount: 350,
                },
              ]);
            }
            if (selectCallCount === 12) {
              // Engagement distribution
              return createQueryChain([
                { status: 'aktif', count: 120 },
                { status: 'rutin', count: 80 },
              ]);
            }
            if (selectCallCount === 13) {
              // Donations by program
              return createQueryChain([
                {
                  programId: 'prog_1',
                  programName: 'Operasional Dakwah & Kajian',
                  programCode: 'DAKWAH',
                  totalAmountRupiah: '75000000',
                  donationsCount: 15,
                },
              ]);
            }
            if (selectCallCount === 14) {
              // Waqf stages
              return createQueryChain([
                {
                  stage: 'interested',
                  caseCount: 4,
                  totalEstimatedRupiah: '5000000000',
                },
              ]);
            }
            // Task completion
            return createQueryChain([
              { status: 'completed', count: 30 },
              { status: 'pending', count: 10 },
            ]);
          }),
        };
      }),
      query: {
        tasks: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        donations: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_dash_test',
      method: 'GET',
      path: '/api/dashboard/stats',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: leadershipUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);

    // Verify 10 KPIs structure
    expect(json.data.kpis).toBeDefined();
    expect(json.data.kpis.totalJamaah).toBe(42);
    expect(json.data.kpis.monthDonationsRupiah).toBe(150000000);
    expect(json.data.kpis).toHaveProperty('aktifJamaah');
    expect(json.data.kpis).toHaveProperty('rutinJamaah');
    expect(json.data.kpis).toHaveProperty('dormanJamaah');
    expect(json.data.kpis).toHaveProperty('overdueTasks');
    expect(json.data.kpis).toHaveProperty('unverifiedDonations');
    expect(json.data.kpis).toHaveProperty('activeWaqfCases');
    expect(json.data.kpis).toHaveProperty('agingWaqfCases');
    expect(json.data.kpis).toHaveProperty('dataQualityIssues');

    // Verify 5 Charts datasets
    expect(json.data.charts).toBeDefined();
    expect(json.data.charts.attendanceTrend.length).toBeGreaterThan(0);
    expect(json.data.charts.engagementDistribution.length).toBeGreaterThan(0);
    expect(json.data.charts.donationsByProgram.length).toBeGreaterThan(0);
    expect(json.data.charts.waqfStages.length).toBeGreaterThan(0);
    expect(json.data.charts.taskCompletion.length).toBeGreaterThan(0);

    // Verify Action Queues
    expect(json.data.queues).toBeDefined();
    expect(json.data.queues).toHaveProperty('urgentTasks');
    expect(json.data.queues).toHaveProperty('unverifiedDonations');
  });
});
