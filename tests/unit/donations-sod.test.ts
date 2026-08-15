import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDonationsRoutes } from '../../server/domain/donations/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import { donations, personRoles, auditLogs } from '../../server/db/schema';

describe('Donatur & Donasi (Step 11 / Segregation of Duties & Finance Verification)', () => {
  const router = new Router();
  registerDonationsRoutes(router);

  const fundraisingUser = {
    id: '018f3333-0000-7000-8000-111111111111',
    authSubject: 'sub_fundraising',
    email: 'fundraising@tarbiyahsunnah.id',
    fullName: 'Fundraising Officer',
    roles: [ROLES.FUNDRAISING_OFFICER],
    permissions: [PERMISSIONS.DONATIONS_CREATE, PERMISSIONS.DONATIONS_LIST, PERMISSIONS.DONATIONS_VIEW_DETAIL],
    isActive: true,
  };

  const financeVerifierUser = {
    id: '018f4444-0000-7000-8000-222222222222',
    authSubject: 'sub_finance',
    email: 'verifier@tarbiyahsunnah.id',
    fullName: 'Finance Verifier',
    roles: [ROLES.FINANCE_VERIFIER],
    permissions: [
      PERMISSIONS.DONATIONS_VERIFY,
      PERMISSIONS.DONATIONS_REJECT,
      PERMISSIONS.DONATIONS_CORRECT_VERIFIED,
      PERMISSIONS.DONATIONS_LIST,
      PERMISSIONS.DONATIONS_VIEW_DETAIL,
    ],
    isActive: true,
  };

  it('Fundraising officer can CREATE donation, and verification_status defaults to unverified', async () => {
    const insertedDonations: any[] = [];
    const insertedRoles: any[] = [];

    const mockTx = {
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === donations || table?.name === 'donations' || table?._?.name === 'donations') {
              const row = { id: 'don_123', ...data };
              insertedDonations.push(row);
              return { returning: () => Promise.resolve([row]) };
            }
            if (table === personRoles || table?.name === 'person_roles' || table?._?.name === 'person_roles') {
              insertedRoles.push(data);
              return Promise.resolve();
            }
            return { returning: () => Promise.resolve([{ id: 'mock' }]) };
          }),
        };
      }),
      query: {
        personRoles: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      insert: mockTx.insert,
      query: mockTx.query,
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_don_create',
      method: 'POST',
      path: '/api/donations',
      headers: {},
      query: {},
      params: {},
      user: fundraisingUser,
      body: {
        personId: '018f0000-0000-0000-0000-000000000001',
        programId: '018f0000-0000-0000-0000-000000000099',
        amountRupiah: 5000000,
        donationDate: new Date().toISOString(),
        paymentMethod: 'bank_transfer',
        externalReference: 'BSI-REF-998822',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.data.verificationStatus).toBe('unverified');
    expect(json.data.amountRupiah).toBe(5000000);

    expect(insertedRoles.length).toBe(1);
    expect(insertedRoles[0].roleCode).toBe('donatur');
  });

  it('Fundraising officer is strictly FORBIDDEN from verifying a donation (SOD constraint)', async () => {
    const mockDb = {
      update: vi.fn(),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_fundraising_verify',
      method: 'POST',
      path: '/api/donations/don_123/verify',
      headers: {},
      query: {},
      params: { id: 'don_123' },
      user: fundraisingUser, // Fundraising officer tries to verify
      body: {},
    });

    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('Finance Verifier executes 8-step verification flow with audit log inside transaction', async () => {
    const insertedAuditLogs: any[] = [];
    const mockExistingDonation = {
      id: 'don_123',
      verificationStatus: 'unverified',
      amountRupiah: BigInt(5000000),
      programId: 'prog_1',
      paymentMethod: 'bank_transfer',
      externalReference: 'BSI-888',
    };

    const mockTx = {
      query: {
        donations: {
          findFirst: vi.fn().mockResolvedValue(mockExistingDonation),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: () =>
              Promise.resolve([
                {
                  ...mockExistingDonation,
                  verificationStatus: 'verified',
                  verifiedBy: financeVerifierUser.id,
                  verifiedAt: new Date(),
                },
              ]),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === auditLogs || table?.name === 'audit_logs' || table?._?.name === 'audit_logs') {
              insertedAuditLogs.push(data);
            }
            return Promise.resolve();
          }),
        };
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_finance_verify',
      method: 'POST',
      path: '/api/donations/don_123/verify',
      headers: {},
      query: {},
      params: { id: 'don_123' },
      user: financeVerifierUser,
      body: { reason: 'Mutasi bank BSI telah diverifikasi cocok' },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.verificationStatus).toBe('verified');
    expect(json.data.amountRupiah).toBe(5000000);

    // Verify audit log emitted with before and after states
    expect(insertedAuditLogs.length).toBe(1);
    expect(insertedAuditLogs[0].action).toBe('verify_donation');
    expect(insertedAuditLogs[0].beforeJson.verificationStatus).toBe('unverified');
    expect(insertedAuditLogs[0].afterJson.verificationStatus).toBe('verified');
  });

  it('Generic update on verified donation is BLOCKED with VALIDATION_ERROR', async () => {
    const mockVerifiedDonation = {
      id: 'don_verified_99',
      verificationStatus: 'verified',
      amountRupiah: BigInt(10000000),
    };

    const mockDb = {
      query: {
        donations: {
          findFirst: vi.fn().mockResolvedValue(mockVerifiedDonation),
        },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_generic_update_blocked',
      method: 'PUT',
      path: '/api/donations/don_verified_99',
      headers: {},
      query: {},
      params: { id: 'don_verified_99' },
      user: fundraisingUser,
      body: {
        amountRupiah: 15000000,
      },
    });

    expect(res.statusCode).toBe(422);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.message).toContain('tidak dapat diubah melalui edit biasa');
  });

  it('Correction flow allows verified donation adjustments with mandatory audit trail', async () => {
    const insertedAuditLogs: any[] = [];
    const mockVerifiedDonation = {
      id: 'don_verified_99',
      verificationStatus: 'verified',
      amountRupiah: BigInt(10000000),
      programId: 'prog_dakwah',
      paymentMethod: 'bank_transfer',
      externalReference: 'REF-OLD',
    };

    const mockTx = {
      query: {
        donations: {
          findFirst: vi.fn().mockResolvedValue(mockVerifiedDonation),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: () =>
              Promise.resolve([
                {
                  ...mockVerifiedDonation,
                  amountRupiah: BigInt(12000000),
                },
              ]),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((table) => {
        return {
          values: vi.fn().mockImplementation((data) => {
            if (table === auditLogs || table?.name === 'audit_logs' || table?._?.name === 'audit_logs') {
              insertedAuditLogs.push(data);
            }
            return Promise.resolve();
          }),
        };
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_correction_flow',
      method: 'POST',
      path: '/api/donations/don_verified_99/correction',
      headers: {},
      query: {},
      params: { id: 'don_verified_99' },
      user: financeVerifierUser,
      body: {
        reason: 'Penyesuaian nominal sesuai bukti mutasi rekening koran BCA',
        amountRupiah: 12000000,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.amountRupiah).toBe(12000000);

    expect(insertedAuditLogs.length).toBe(1);
    expect(insertedAuditLogs[0].action).toBe('correct_verified_donation');
    expect(insertedAuditLogs[0].reason).toContain('Penyesuaian nominal');
  });
});
