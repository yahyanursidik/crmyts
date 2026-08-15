import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerDonationsRoutes } from '../../server/domain/donations/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Integration: Donation Finance Verification & Correction Flow (CRM YTS)', () => {
  const router = new Router();
  registerDonationsRoutes(router);

  const financeUser = {
    id: '018f4444-0000-7000-8000-444444444444',
    authSubject: 'sub_finance',
    email: 'finance@tarbiyahsunnah.id',
    fullName: 'Finance Verifier',
    roles: [ROLES.FINANCE_VERIFIER, ROLES.FUNDRAISING_OFFICER],
    permissions: [
      PERMISSIONS.DONATIONS_LIST,
      PERMISSIONS.DONATIONS_CREATE,
      PERMISSIONS.DONATIONS_VIEW_DETAIL,
      PERMISSIONS.DONATIONS_VERIFY,
      PERMISSIONS.DONATIONS_REJECT,
      PERMISSIONS.DONATIONS_CORRECT_VERIFIED,
    ],
    isActive: true,
  };

  const sampleDonation = {
    id: '018f0000-0000-7000-8000-999999999999',
    personId: '018faaaa-0000-7000-8000-000000000001',
    programId: '018fbbbb-0000-7000-8000-000000000002',
    donationDate: new Date(),
    amountRupiah: '500000',
    verificationStatus: 'unverified',
    paymentMethod: 'bank_transfer',
    notes: 'Infaq operasional dakwah',
  };

  it('Verifies unverified donation atomically with audit logging', async () => {
    const verifiedRecord = {
      ...sampleDonation,
      verificationStatus: 'verified',
      verifiedBy: financeUser.id,
      verifiedAt: new Date(),
    };

    const mockTx = {
      query: {
        donations: {
          findFirst: vi.fn().mockResolvedValue(sampleDonation),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([verifiedRecord]),
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
      requestId: 'req_donation_verify',
      method: 'POST',
      path: `/api/donations/${sampleDonation.id}/verify`,
      headers: {},
      query: {},
      params: { id: sampleDonation.id },
      body: {},
      user: financeUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.verificationStatus).toBe('verified');
  });

  it('Blocks generic update on already-verified donation (Must use correction flow)', async () => {
    const verifiedDonation = {
      ...sampleDonation,
      verificationStatus: 'verified',
    };

    const mockDb = {
      query: {
        donations: {
          findFirst: vi.fn().mockResolvedValue(verifiedDonation),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_generic_update_blocked',
      method: 'PUT',
      path: `/api/donations/${sampleDonation.id}`,
      headers: {},
      query: {},
      params: { id: sampleDonation.id },
      body: {
        amountRupiah: 1000000,
      },
      user: financeUser,
    });

    expect(res.statusCode).toBe(422);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
