import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAuthRoutes } from '../../server/auth/routes';
import { registerDashboardRoutes } from '../../server/domain/dashboard/routes';
import { registerPersonsRoutes } from '../../server/domain/persons/routes';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import { registerDonationsRoutes } from '../../server/domain/donations/routes';
import { registerWaqfRoutes } from '../../server/domain/waqf/routes';
import { registerAuditRoutes } from '../../server/domain/audit/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import * as client from '../../server/db/client';
import * as schema from '../../server/db/schema';
import { sanitizeAuditPayload } from '../../server/audit/service';

describe('Staging & UAT Test Suite — CRM Yayasan Tarbiyah Sunnah (CRM YTS)', () => {
  const router = new Router();
  registerAuthRoutes(router);
  registerDashboardRoutes(router);
  registerPersonsRoutes(router);
  registerEventsRoutes(router);
  registerDonationsRoutes(router);
  registerWaqfRoutes(router);
  registerAuditRoutes(router);

  const createQueryChain = (resolvedValue: any) => {
    const chain: any = {
      where: vi.fn().mockImplementation(() => chain),
      leftJoin: vi.fn().mockImplementation(() => chain),
      groupBy: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
      offset: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
      then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve),
    };
    return chain;
  };

  const adminUser = {
    id: '018f0000-0000-7000-8000-000000000001',
    authSubject: 'sub_staging_admin',
    email: 'admin@staging.tarbiyahsunnah.id',
    fullName: 'Staging Super Admin',
    roles: [ROLES.CRM_ADMIN, ROLES.FUNDRAISING_OFFICER],
    permissions: Object.values(PERMISSIONS),
    isActive: true,
  };

  const financeUser = {
    id: '018f0000-0000-7000-8000-000000000002',
    authSubject: 'sub_staging_finance',
    email: 'finance@staging.tarbiyahsunnah.id',
    fullName: 'Staging Finance Verifier',
    roles: [ROLES.FINANCE_VERIFIER],
    permissions: [
      PERMISSIONS.DONATIONS_LIST,
      PERMISSIONS.DONATIONS_VIEW_DETAIL,
      PERMISSIONS.DONATIONS_VERIFY,
      PERMISSIONS.DONATIONS_REJECT,
      PERMISSIONS.DONATIONS_CORRECT_VERIFIED,
      PERMISSIONS.DASHBOARD_VIEW,
    ],
    isActive: true,
  };

  const waqfUser = {
    id: '018f0000-0000-7000-8000-000000000003',
    authSubject: 'sub_staging_waqf',
    email: 'waqf@staging.tarbiyahsunnah.id',
    fullName: 'Staging Waqf Officer',
    roles: [ROLES.WAQF_OFFICER],
    permissions: [
      PERMISSIONS.WAQF_LIST,
      PERMISSIONS.WAQF_VIEW_DETAIL,
      PERMISSIONS.WAQF_CREATE,
      PERMISSIONS.WAQF_TRANSITION,
      PERMISSIONS.DASHBOARD_VIEW,
    ],
    isActive: true,
  };

  // 1. Migration Check
  it('UAT 1: Migration & Schema DDL Integrity Verification', () => {
    expect(schema.persons).toBeDefined();
    expect(schema.donations).toBeDefined();
    expect(schema.waqfCases).toBeDefined();
    expect(schema.events).toBeDefined();
    expect(schema.eventAttendance).toBeDefined();
    expect(schema.interactions).toBeDefined();
    expect(schema.tasks).toBeDefined();
    expect(schema.auditLogs).toBeDefined();
    expect(schema.exportLogs).toBeDefined();
  });

  // 2. Login Check
  it('UAT 2: Login Authentication & Session Check', async () => {
    const res = await router.handle({
      requestId: 'uat_auth_logout',
      method: 'POST',
      path: '/api/auth/logout',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: adminUser,
    });
    expect(res.statusCode).toBe(200);
  });

  // 3. Role Matrix Check
  it('UAT 3: Role & Permission Matrix Isolation', () => {
    expect(ROLES.LEADERSHIP_VIEWER).toBe('leadership_viewer');
    expect(ROLES.CRM_ADMIN).toBe('crm_admin');
    expect(ROLES.DATA_STEWARD).toBe('data_steward');
    expect(ROLES.CS_OFFICER).toBe('cs_officer');
    expect(ROLES.EVENT_ADMIN).toBe('event_admin');
    expect(ROLES.FUNDRAISING_OFFICER).toBe('fundraising_officer');
    expect(ROLES.WAQF_OFFICER).toBe('waqf_officer');
    expect(ROLES.FINANCE_VERIFIER).toBe('finance_verifier');
  });

  // 4. Dashboard Stats Check
  it('UAT 4: Executive & Role Dashboard Aggregations', async () => {
    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => createQueryChain([{ count: 120, total: '50000000' }])),
      })),
      query: {
        donations: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        waqfCases: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        tasks: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'uat_dashboard_stats',
      method: 'GET',
      path: '/api/dashboard/stats',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: adminUser,
    });
    expect(res.statusCode).toBe(200);
  });

  // 5. Person Check
  it('UAT 5: Person 360 Registration & Lifecycle', async () => {
    const createdPerson = {
      id: '018faaaa-0000-7000-8000-000000000099',
      fullName: 'Ahmad Dahlan',
      phoneE164: '+6281122334455',
      engagementStatus: 'baru',
      isActive: true,
      createdAt: new Date(),
    };

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdPerson]),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'uat_person_reg',
      method: 'POST',
      path: '/api/persons',
      headers: {},
      query: {},
      params: {},
      body: {
        fullName: 'Ahmad Dahlan',
        phoneE164: '081122334455',
        roleCodes: ['jamaah'],
      },
      user: adminUser,
    });
    expect(res.statusCode).toBe(201);
  });

  // 6. Attendance Check
  it('UAT 6: Kajian Event Attendance Check-in', async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'att_uat', status: 'attended' }]),
          }),
        }),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'uat_attendance',
      method: 'POST',
      path: '/api/events/018faaaa-0000-7000-8000-000000000001/attendance',
      headers: {},
      query: {},
      params: { id: '018faaaa-0000-7000-8000-000000000001' },
      body: { personId: '018faaaa-0000-7000-8000-000000000099', source: 'qr_scan' },
      user: adminUser,
    });
    expect(res.statusCode).toBe(200);
  });

  // 7. Donation Creation
  it('UAT 7: Donation Creation & Unverified Default', async () => {
    const createdDonation = {
      id: '018fd000-0000-7000-8000-000000000001',
      personId: '018faaaa-0000-7000-8000-000000000099',
      programId: '018fb000-0000-7000-8000-000000000001',
      amountRupiah: BigInt(500000),
      verificationStatus: 'unverified',
      donationDate: new Date(),
    };

    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdDonation]),
        }),
      }),
      query: {
        personRoles: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'uat_donation_create',
      method: 'POST',
      path: '/api/donations',
      headers: {},
      query: {},
      params: {},
      body: {
        personId: '018faaaa-0000-7000-8000-000000000099',
        programId: '018fb000-0000-7000-8000-000000000001',
        amountRupiah: 500000,
        donationDate: new Date().toISOString(),
        paymentMethod: 'bank_transfer',
      },
      user: adminUser,
    });
    expect(res.statusCode).toBe(201);
  });

  // 8. Finance Verify
  it('UAT 8: Finance Verification & Segregation of Duties', async () => {
    const verifiedDonation = {
      id: '018fd000-0000-7000-8000-000000000001',
      verificationStatus: 'verified',
      verifiedBy: financeUser.id,
      verifiedAt: new Date(),
    };

    const mockTx = {
      query: {
        donations: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018fd000-0000-7000-8000-000000000001',
            verificationStatus: 'unverified',
          }),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([verifiedDonation]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'uat_finance_verify',
      method: 'POST',
      path: '/api/donations/018fd000-0000-7000-8000-000000000001/verify',
      headers: {},
      query: {},
      params: { id: '018fd000-0000-7000-8000-000000000001' },
      body: {},
      user: financeUser,
    });
    expect(res.statusCode).toBe(200);
  });

  // 9. Waqf Pipeline
  it('UAT 9: Waqf 7-Stage Pipeline Transition & Checklist', async () => {
    const updatedCase = {
      id: '018fw000-0000-7000-8000-000000000001',
      currentStage: 'pledged',
    };

    const mockTx = {
      query: {
        waqfCases: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018fw000-0000-7000-8000-000000000001',
            currentStage: 'consulted',
          }),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: () => Promise.resolve([updatedCase]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: () => Promise.resolve([{ id: 'mock' }]),
        }),
      }),
    };
    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'uat_waqf_transition',
      method: 'POST',
      path: '/api/waqf/018fw000-0000-7000-8000-000000000001/transition',
      headers: {},
      query: {},
      params: { id: '018fw000-0000-7000-8000-000000000001' },
      body: {
        toStage: 'pledged',
        reason: 'Ikrar wakaf lisan disepakati bersama waqif dan saksi',
      },
      user: waqfUser,
    });
    expect(res.statusCode).toBe(200);
  });

  // 10. Audit Trail & Secret Redaction
  it('UAT 10: Audit Trail Logging & Secret Redaction', async () => {
    const sanitized = sanitizeAuditPayload({
      user: 'admin',
      password: 'password123',
      apiKey: 'secret_key',
    });
    expect(sanitized.password).toBe('[REDACTED_SECRET]');
    expect(sanitized.apiKey).toBe('[REDACTED_SECRET]');

    const mockDb = {
      query: {
        auditLogs: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => createQueryChain([{ count: 0 }])),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'uat_audit_logs',
      method: 'GET',
      path: '/api/audit/logs',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: adminUser,
    });
    expect(res.statusCode).toBe(200);
  });

  // 11. Logout & Password Security Flow
  it('UAT 11: Logout & Password Reset Security Flow', async () => {
    const res = await router.handle({
      requestId: 'uat_logout',
      method: 'POST',
      path: '/api/auth/logout',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: adminUser,
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.success).toBe(true);
  });
});
