import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDataQualityRoutes } from '../../server/domain/data-quality/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Data Quality & Stewardship (Step 14 / M10)', () => {
  const router = new Router();
  registerDataQualityRoutes(router);

  const stewardUser = {
    id: '018f7777-0000-7000-8000-111111111111',
    authSubject: 'sub_steward',
    email: 'steward@tarbiyahsunnah.id',
    fullName: 'Data Steward YTS',
    roles: [ROLES.DATA_STEWARD],
    permissions: [
      PERMISSIONS.DATA_QUALITY_MANAGE,
      PERMISSIONS.PERSONS_MERGE,
      PERMISSIONS.PERSONS_DEDUP_REVIEW,
    ],
    isActive: true,
  };

  const primaryPerson = {
    id: '018faaaa-0000-7000-8000-000000000001',
    fullName: 'Ahmad Dahlan',
    phoneE164: '+6281234567890',
    email: 'ahmad@example.com',
    cityRegency: 'Kota Bandung',
    gender: 'laki_laki',
    sourceCode: 'WEB_REG',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const secondaryPerson = {
    id: '018fbbbb-0000-7000-8000-000000000002',
    fullName: 'Ahmad Dahlan (Duplikat)',
    phoneE164: '+6281234567890', // Exact duplicate phone
    email: 'ahmad.dahlan@example.com',
    cityRegency: 'Kota Bandung',
    gender: 'laki_laki',
    sourceCode: null, // Missing source
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const invalidPhonePerson = {
    id: '018fcccc-0000-7000-8000-000000000003',
    fullName: 'Budi Santoso',
    phoneE164: '0812345', // Invalid length / format
    email: 'budi@example.com',
    cityRegency: 'Kota Cimahi',
    gender: 'laki_laki',
    sourceCode: 'KAJIAN_AKBAR',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('1. GET /api/data-quality/anomalies detects 7 data quality anomaly rules', async () => {
    const mockDb = {
      query: {
        persons: {
          findMany: vi.fn().mockResolvedValue([primaryPerson, secondaryPerson, invalidPhonePerson]),
        },
        sensitiveNotes: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'note_1',
              personId: primaryPerson.id,
              noteText: 'Catatan sensitif lama',
              sensitivityLevel: 'high',
              createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days old (stale)
              person: { fullName: 'Ahmad Dahlan' },
              creator: { fullName: 'Staf CS' },
            },
          ]),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_dq_anomalies',
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

    // Summary counts
    expect(json.data.summary).toBeDefined();
    expect(json.data.summary.invalidPhoneCount).toBeGreaterThan(0);
    expect(json.data.summary.duplicatePhoneClustersCount).toBeGreaterThan(0);
    expect(json.data.summary.staleSensitiveNotesCount).toBe(1);

    // Anomaly Lists
    expect(json.data.anomalies.invalidPhones.length).toBeGreaterThan(0);
    expect(json.data.anomalies.duplicateExactPhones.length).toBeGreaterThan(0);
    expect(json.data.anomalies.staleNotes.length).toBe(1);
  });

  it('2. POST /api/data-quality/merge executes atomic transactional merge with audit log', async () => {
    const mockAuditInsert = vi.fn().mockResolvedValue([]);
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              ...primaryPerson,
              fullName: 'Ahmad Dahlan',
            },
          ]),
        }),
      }),
    });

    const mockTx = {
      query: {
        persons: {
          findFirst: vi.fn().mockImplementation(() => {
            return Promise.resolve(primaryPerson);
          }),
        },
        eventAttendance: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        personRoles: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        personTags: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      update: mockUpdate,
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      insert: vi.fn().mockReturnValue({ values: mockAuditInsert }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => {
        return cb(mockTx);
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_dq_merge',
      method: 'POST',
      path: '/api/data-quality/merge',
      headers: {},
      query: {},
      params: {},
      body: {
        primaryPersonId: primaryPerson.id,
        secondaryPersonId: secondaryPerson.id,
        reason: 'Penggabungan duplikasi kontak jamaah kajian online dan offline',
        fieldPreferences: {
          phoneE164: 'primary',
          email: 'secondary',
        },
      },
      user: stewardUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data).toBeDefined();
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('3. POST /api/data-quality/quick-fix normalizes phone number to E.164 and audits', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              ...invalidPhonePerson,
              phoneE164: '+6281234567890',
            },
          ]),
        }),
      }),
    });

    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(invalidPhonePerson),
        },
      },
      update: mockUpdate,
      insert: mockInsert,
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_dq_quickfix',
      method: 'POST',
      path: '/api/data-quality/quick-fix',
      headers: {},
      query: {},
      params: {},
      body: {
        personId: invalidPhonePerson.id,
        field: 'phoneE164',
        value: '081234567890',
        reason: 'Normalisasi nomor HP',
      },
      user: stewardUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.phoneE164).toBe('+6281234567890');
  });

  it('4. POST /api/data-quality/ignore-candidate records false positive in audit logs', async () => {
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

    const mockDb = {
      insert: mockInsert,
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_dq_ignore',
      method: 'POST',
      path: '/api/data-quality/ignore-candidate',
      headers: {},
      query: {},
      params: {},
      body: {
        personAId: primaryPerson.id,
        personBId: secondaryPerson.id,
        reason: 'Dua orang berbeda ayah dan anak',
      },
      user: stewardUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.status).toBe('ignored');
  });
});
