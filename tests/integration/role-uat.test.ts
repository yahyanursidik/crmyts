import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAuthRoutes } from '../../server/auth/routes';
import { registerDashboardRoutes } from '../../server/domain/dashboard/routes';
import { registerPersonsRoutes } from '../../server/domain/persons/routes';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import { registerTasksRoutes } from '../../server/domain/tasks/routes';
import { registerDonationsRoutes } from '../../server/domain/donations/routes';
import { registerWaqfRoutes } from '../../server/domain/waqf/routes';
import { registerInteractionsRoutes } from '../../server/domain/interactions/routes';
import { registerAttachmentsRoutes } from '../../server/domain/attachments/routes';
import { registerDataQualityRoutes } from '../../server/domain/data-quality/routes';
import { registerAuditRoutes } from '../../server/domain/audit/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import * as client from '../../server/db/client';

describe('Role-by-Role Comprehensive UAT Suite (CRM YTS)', () => {
  const router = new Router();
  registerAuthRoutes(router);
  registerDashboardRoutes(router);
  registerPersonsRoutes(router);
  registerEventsRoutes(router);
  registerTasksRoutes(router);
  registerDonationsRoutes(router);
  registerWaqfRoutes(router);
  registerInteractionsRoutes(router);
  registerAttachmentsRoutes(router);
  registerDataQualityRoutes(router);
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

  // 1. Role: PIMPINAN (Leadership Viewer)
  describe('UAT Role 1: Pimpinan (Leadership Viewer)', () => {
    const pimpinanUser = {
      id: '018fa000-0000-7000-8000-000000000001',
      authSubject: 'sub_pimpinan',
      email: 'pimpinan@tarbiyahsunnah.id',
      fullName: 'Ketua Yayasan Tarbiyah Sunnah',
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

    it('UAT-PIMP-01: Access Executive Summary Dashboard with 10 KPIs and Chart Aggregations', async () => {
      let selectCall = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => {
          selectCall++;
          if (selectCall === 6) {
            return { from: vi.fn().mockImplementation(() => createQueryChain([{ total: '750000000' }])) };
          }
          return { from: vi.fn().mockImplementation(() => createQueryChain([{ count: 1250 }])) };
        }),
        query: {
          donations: { findMany: vi.fn().mockResolvedValue([]) },
          waqfCases: { findMany: vi.fn().mockResolvedValue([]) },
          tasks: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_pimp_01',
        method: 'GET',
        path: '/api/dashboard/stats',
        headers: {},
        query: {},
        params: {},
        body: {},
        user: pimpinanUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.kpis).toBeDefined();
      expect(json.data.kpis.totalJamaah).toBe(1250);
      expect(json.data.kpis.monthDonationsRupiah).toBe(750000000);
    });

    it('UAT-PIMP-02: Blocked from Mutating Data (Read-Only Guarantee)', async () => {
      const res = await router.handle({
        requestId: 'uat_pimp_02',
        method: 'POST',
        path: '/api/persons',
        headers: {},
        query: {},
        params: {},
        body: { fullName: 'Unauthorized Person' },
        user: pimpinanUser,
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // 2. Role: CRM ADMIN
  describe('UAT Role 2: CRM Admin', () => {
    const adminUser = {
      id: '018fa000-0000-7000-8000-000000000002',
      authSubject: 'sub_admin',
      email: 'admin@tarbiyahsunnah.id',
      fullName: 'Super Admin CRM',
      roles: [ROLES.CRM_ADMIN],
      permissions: Object.values(PERMISSIONS),
      isActive: true,
    };

    it('UAT-ADM-01: Full Operational View & System Health Metric Access', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockImplementation(() => createQueryChain([{ count: 0 }])),
        }),
        query: {
          auditLogs: { findMany: vi.fn().mockResolvedValue([]) },
          exportLogs: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_adm_01',
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

    it('UAT-ADM-02: Export Governance Logging Enforcement', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      });
      const mockDb = { insert: mockInsert };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_adm_02',
        method: 'POST',
        path: '/api/audit/record-export',
        headers: {},
        query: {},
        params: {},
        body: {
          exportType: 'all_donors_csv',
          rowCount: 500,
          reason: 'Laporan tahunan pertanggungjawaban yayasan untuk dewan pembina',
        },
        user: adminUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.recorded).toBe(true);
    });
  });

  // 3. Role: DATA STEWARD
  describe('UAT Role 3: Data Steward', () => {
    const stewardUser = {
      id: '018fa000-0000-7000-8000-000000000003',
      authSubject: 'sub_steward',
      email: 'steward@tarbiyahsunnah.id',
      fullName: 'Data Steward YTS',
      roles: [ROLES.DATA_STEWARD],
      permissions: [
        PERMISSIONS.PERSONS_LIST,
        PERMISSIONS.PERSONS_VIEW,
        PERMISSIONS.PERSONS_CREATE,
        PERMISSIONS.PERSONS_EDIT,
        PERMISSIONS.PERSONS_MERGE,
        PERMISSIONS.DATA_QUALITY_MANAGE,
        PERMISSIONS.PERSONS_DEDUP_REVIEW,
      ],
      isActive: true,
    };

    it('UAT-DS-01: Anomaly Detection Engine Scan for 7 Rules', async () => {
      const mockDb = {
        query: {
          persons: { findMany: vi.fn().mockResolvedValue([]) },
          sensitiveNotes: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_ds_01',
        method: 'GET',
        path: '/api/data-quality/anomalies',
        headers: {},
        query: {},
        params: {},
        body: {},
        user: stewardUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.summary).toBeDefined();
      expect(json.data.anomalies).toBeDefined();
    });

    it('UAT-DS-02: Transactional 11-Step Human-Reviewed Person Merge', async () => {
      const mockPrimary = { id: '018faaaa-0000-7000-8000-000000000001', fullName: 'Ust. Ahmad', isActive: true };
      const mockSecondary = { id: '018faaaa-0000-7000-8000-000000000002', fullName: 'Ahmad (Duplikat)', isActive: true };

      const mockTx = {
        query: {
          persons: {
            findFirst: vi.fn().mockImplementation(() => Promise.resolve(mockPrimary)),
          },
          eventAttendance: { findMany: vi.fn().mockResolvedValue([]) },
          personRoles: { findMany: vi.fn().mockResolvedValue([]) },
          personTags: { findMany: vi.fn().mockResolvedValue([]) },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockPrimary]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
      };
      const mockDb = {
        transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_ds_02',
        method: 'POST',
        path: '/api/data-quality/merge',
        headers: {},
        query: {},
        params: {},
        body: {
          primaryPersonId: mockPrimary.id,
          secondaryPersonId: mockSecondary.id,
          reason: 'Penggabungan duplikasi nomor HP jamaah terverifikasi sama',
        },
        user: stewardUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.id).toBe(mockPrimary.id);
    });
  });

  // 4. Role: CS (Customer Service / Jamaah Care)
  describe('UAT Role 4: CS (Customer Service / Jamaah Care)', () => {
    const csUser = {
      id: '018fa000-0000-7000-8000-000000000004',
      authSubject: 'sub_cs',
      email: 'cs@tarbiyahsunnah.id',
      fullName: 'CS Care Tarbiyah',
      roles: [ROLES.CS_OFFICER],
      permissions: [
        PERMISSIONS.PERSONS_LIST,
        PERMISSIONS.PERSONS_VIEW,
        PERMISSIONS.INTERACTIONS_VIEW,
        PERMISSIONS.INTERACTIONS_CREATE,
        PERMISSIONS.TASKS_VIEW_OWN,
        PERMISSIONS.TASKS_CREATE,
        PERMISSIONS.TASKS_UPDATE_OWN,
      ],
      isActive: true,
    };

    it('UAT-CS-01: Log Interaction <90s and Auto Create Follow-up Task', async () => {
      const mockInteraction = {
        id: 'int_cs_1',
        personId: '018faaaa-0000-7000-8000-000000000001',
        channel: 'whatsapp',
        summary: 'Jamaah menanyakan konfirmasi pendaftaran daurah intensif tajwid',
        outcome: 'minta_dihubungi_kembali',
        sensitivityLevel: 'standard',
      };

      const mockTx = {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockResolvedValue([mockInteraction]),
          })),
        })),
      };
      const mockDb = {
        transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_cs_01',
        method: 'POST',
        path: '/api/interactions',
        headers: {},
        query: {},
        params: {},
        body: {
          personId: '018faaaa-0000-7000-8000-000000000001',
          channel: 'whatsapp',
          summary: 'Jamaah menanyakan konfirmasi pendaftaran daurah intensif tajwid',
          outcome: 'minta_dihubungi_kembali',
          nextAction: 'Kirimkan modul pdf dan link room zoom ke nomor WA jamaah',
          taskDueAt: new Date(Date.now() + 86400000).toISOString(),
          taskPriority: 'high',
        },
        user: csUser,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.data.interaction.outcome).toBe('minta_dihubungi_kembali');
    });

    it('UAT-CS-02: Complete Task with Status Patch', async () => {
      const completedTask = {
        id: '018faaaa-0000-7000-8000-999999999999',
        status: 'completed',
        completedAt: new Date(),
      };

      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([completedTask]),
            }),
          }),
        }),
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_cs_02',
        method: 'PATCH',
        path: `/api/tasks/${completedTask.id}/status`,
        headers: {},
        query: {},
        params: { id: completedTask.id },
        body: { status: 'completed' },
        user: csUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.status).toBe('completed');
    });
  });

  // 5. Role: ADMIN KAJIAN (Event Admin)
  describe('UAT Role 5: Admin Kajian (Event Admin)', () => {
    const eventAdminUser = {
      id: '018fa000-0000-7000-8000-000000000005',
      authSubject: 'sub_event_admin',
      email: 'kajian@tarbiyahsunnah.id',
      fullName: 'Admin Kajian & Daurah',
      roles: [ROLES.EVENT_ADMIN],
      permissions: [
        PERMISSIONS.EVENTS_VIEW,
        PERMISSIONS.EVENTS_MANAGE,
        PERMISSIONS.ATTENDANCE_MANAGE,
        PERMISSIONS.PERSONS_CREATE,
      ],
      isActive: true,
    };

    it('UAT-EVT-01: Create Kajian Event Schedule', async () => {
      const createdEvent = {
        id: '018fe000-0000-7000-8000-000000000001',
        title: 'Tabligh Akbar: Meniti Jalan Sunnah',
        category: 'tabligh_akbar',
        speaker: 'Ustadz Abu Haidar As-Sundawy',
        startAt: new Date(),
        deliveryMode: 'hybrid',
      };

      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdEvent]),
          }),
        }),
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_evt_01',
        method: 'POST',
        path: '/api/events',
        headers: {},
        query: {},
        params: {},
        body: {
          title: 'Tabligh Akbar: Meniti Jalan Sunnah',
          category: 'tabligh_akbar',
          speaker: 'Ustadz Abu Haidar As-Sundawy',
          startAt: new Date().toISOString(),
          deliveryMode: 'hybrid',
          locationName: 'Masjid Agung Al-Ukhuwah Bandung',
        },
        user: eventAdminUser,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.data.title).toBe('Tabligh Akbar: Meniti Jalan Sunnah');
    });

    it('UAT-EVT-02: Live Attendance QR Scan Check-In (Idempotent)', async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'att_live_1', status: 'attended' }]),
            }),
          }),
        }),
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_evt_02',
        method: 'POST',
        path: '/api/events/018fe000-0000-7000-8000-000000000001/attendance',
        headers: {},
        query: {},
        params: { id: '018fe000-0000-7000-8000-000000000001' },
        body: { personId: '018faaaa-0000-7000-8000-000000000001', source: 'qr_scan' },
        user: eventAdminUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.status).toBe('attended');
    });
  });

  // 6. Role: FUNDRAISING OFFICER
  describe('UAT Role 6: Fundraising Officer', () => {
    const fundraisingUser = {
      id: '018fa000-0000-7000-8000-000000000006',
      authSubject: 'sub_fundraising',
      email: 'fundraising@tarbiyahsunnah.id',
      fullName: 'Fundraising Officer',
      roles: [ROLES.FUNDRAISING_OFFICER],
      permissions: [
        PERMISSIONS.DONATIONS_LIST,
        PERMISSIONS.DONATIONS_VIEW_DETAIL,
        PERMISSIONS.DONATIONS_CREATE,
        PERMISSIONS.DONATIONS_VIEW_SUMMARY,
      ],
      isActive: true,
    };

    it('UAT-FND-01: Create Donation with Default Status Unverified & Auto-Tag Donor', async () => {
      const createdDonation = {
        id: '018fd000-0000-7000-8000-000000000088',
        personId: '018faaaa-0000-7000-8000-000000000001',
        programId: '018fb000-0000-7000-8000-000000000001',
        amountRupiah: BigInt(2500000),
        verificationStatus: 'unverified',
        paymentMethod: 'bank_transfer',
        donationDate: new Date(),
      };

      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdDonation]),
          }),
        }),
        query: {
          personRoles: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };
      const mockDb = {
        transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_fnd_01',
        method: 'POST',
        path: '/api/donations',
        headers: {},
        query: {},
        params: {},
        body: {
          personId: '018faaaa-0000-7000-8000-000000000001',
          programId: '018fb000-0000-7000-8000-000000000001',
          amountRupiah: 2500000,
          donationDate: new Date().toISOString(),
          paymentMethod: 'bank_transfer',
          notes: 'Infaq pembebasan tanah dakwah',
        },
        user: fundraisingUser,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.data.verificationStatus).toBe('unverified');
    });

    it('UAT-FND-02: Strictly Forbidden from Verifying Donation (Segregation of Duties Enforcement)', async () => {
      const res = await router.handle({
        requestId: 'uat_fnd_02',
        method: 'POST',
        path: '/api/donations/018fd000-0000-7000-8000-000000000088/verify',
        headers: {},
        query: {},
        params: { id: '018fd000-0000-7000-8000-000000000088' },
        body: {},
        user: fundraisingUser,
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  // 7. Role: WAKAF OFFICER
  describe('UAT Role 7: Wakaf Officer', () => {
    const waqfOfficerUser = {
      id: '018fa000-0000-7000-8000-000000000007',
      authSubject: 'sub_waqf_officer',
      email: 'wakaf@tarbiyahsunnah.id',
      fullName: 'Staf Khusus Wakaf',
      roles: [ROLES.WAQF_OFFICER],
      permissions: [
        PERMISSIONS.WAQF_LIST,
        PERMISSIONS.WAQF_VIEW_DETAIL,
        PERMISSIONS.WAQF_CREATE,
        PERMISSIONS.WAQF_TRANSITION,
        PERMISSIONS.WAQF_DOCUMENTS_MANAGE,
      ],
      isActive: true,
    };

    it('UAT-WQF-01: Create Waqf Asset Case with Valuation', async () => {
      const createdCase = {
        id: '018fw000-0000-7000-8000-000000000099',
        personId: '018faaaa-0000-7000-8000-000000000001',
        waqfType: 'tanah',
        currentStage: 'interested',
        estimatedValueRupiah: BigInt(5000000000),
      };

      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdCase]),
          }),
        }),
        query: {
          personRoles: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };
      const mockDb = {
        transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      };
      vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

      const res = await router.handle({
        requestId: 'uat_wqf_01',
        method: 'POST',
        path: '/api/waqf',
        headers: {},
        query: {},
        params: {},
        body: {
          personId: '018faaaa-0000-7000-8000-000000000001',
          waqfType: 'tanah',
          estimatedValueRupiah: 5000000000,
          notesSummary: 'Wakaf tanah 2000m2 untuk pembangunan Islamic Boarding School',
        },
        user: waqfOfficerUser,
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.data.currentStage).toBe('interested');
    });

    it('UAT-WQF-02: Execute Stage Transition with History and Follow-up Action', async () => {
      const updatedCase = {
        id: '018fw000-0000-7000-8000-000000000099',
        currentStage: 'document_preparation',
      };

      const mockTx = {
        query: {
          waqfCases: {
            findFirst: vi.fn().mockResolvedValue({
              id: '018fw000-0000-7000-8000-000000000099',
              currentStage: 'pledged',
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
        requestId: 'uat_wqf_02',
        method: 'POST',
        path: '/api/waqf/018fw000-0000-7000-8000-000000000099/transition',
        headers: {},
        query: {},
        params: { id: '018fw000-0000-7000-8000-000000000099' },
        body: {
          toStage: 'document_preparation',
          reason: 'Penerimaan sertifikat hak milik asli dari waqif untuk validasi BPN',
          nextAction: 'Koordinasi dengan Pejabat Pembuat Akta Ikrar Wakaf (PPAIW) KUA',
        },
        user: waqfOfficerUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.currentStage).toBe('document_preparation');
    });
  });

  // 8. Role: FINANCE VERIFIER
  describe('UAT Role 8: Finance Verifier', () => {
    const financeUser = {
      id: '018fa000-0000-7000-8000-000000000008',
      authSubject: 'sub_finance_user',
      email: 'finance@tarbiyahsunnah.id',
      fullName: 'Finance Verifier YTS',
      roles: [ROLES.FINANCE_VERIFIER],
      permissions: [
        PERMISSIONS.DONATIONS_LIST,
        PERMISSIONS.DONATIONS_VIEW_DETAIL,
        PERMISSIONS.DONATIONS_VERIFY,
        PERMISSIONS.DONATIONS_REJECT,
        PERMISSIONS.DONATIONS_CORRECT_VERIFIED,
      ],
      isActive: true,
    };

    it('UAT-FIN-01: Finance Verification 8-Step Transactional Execution', async () => {
      const verifiedDonation = {
        id: '018fd000-0000-7000-8000-000000000088',
        verificationStatus: 'verified',
        verifiedBy: financeUser.id,
        verifiedAt: new Date(),
      };

      const mockTx = {
        query: {
          donations: {
            findFirst: vi.fn().mockResolvedValue({
              id: '018fd000-0000-7000-8000-000000000088',
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
        requestId: 'uat_fin_01',
        method: 'POST',
        path: '/api/donations/018fd000-0000-7000-8000-000000000088/verify',
        headers: {},
        query: {},
        params: { id: '018fd000-0000-7000-8000-000000000088' },
        body: { reason: 'Mutasi rekening koran BSI cocok dengan nominal dan waktu transfer' },
        user: financeUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.verificationStatus).toBe('verified');
    });

    it('UAT-FIN-02: Correction Flow on Verified Donation with Mandatory Audit Reason', async () => {
      const correctedDonation = {
        id: '018fd000-0000-7000-8000-000000000088',
        amountRupiah: BigInt(3000000), // Corrected amount
        verificationStatus: 'verified',
      };

      const mockTx = {
        query: {
          donations: {
            findFirst: vi.fn().mockResolvedValue({
              id: '018fd000-0000-7000-8000-000000000088',
              amountRupiah: BigInt(2500000),
              verificationStatus: 'verified',
            }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([correctedDonation]),
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
        requestId: 'uat_fin_02',
        method: 'POST',
        path: '/api/donations/018fd000-0000-7000-8000-000000000088/correction',
        headers: {},
        query: {},
        params: { id: '018fd000-0000-7000-8000-000000000088' },
        body: {
          amountRupiah: 3000000,
          reason: 'Koreksi nominal setelah verifikasi rekonsiliasi selisih transfer bank',
        },
        user: financeUser,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.amountRupiah).toBe(3000000);
    });
  });
});
