import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAuditRoutes } from '../../server/domain/audit/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Integration: Data Export Governance & Compliance Logging (CRM YTS)', () => {
  const router = new Router();
  registerAuditRoutes(router);

  const stewardUser = {
    id: '018f7777-0000-7000-8000-111111111111',
    authSubject: 'sub_steward',
    email: 'steward@tarbiyahsunnah.id',
    fullName: 'Data Steward YTS',
    roles: [ROLES.CRM_ADMIN],
    permissions: [
      PERMISSIONS.DATA_EXPORT,
      PERMISSIONS.EXPORTS_VIEW_LOG,
    ],
    isActive: true,
  };

  it('Records data export activity with mandatory reason and row count', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    });

    const mockDb = {
      insert: mockInsert,
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_export_rec',
      method: 'POST',
      path: '/api/audit/record-export',
      headers: {},
      query: {},
      params: {},
      body: {
        exportType: 'jamaah_list_csv',
        rowCount: 250,
        reason: 'Laporan rekap peserta kajian akbar untuk panitia konsumsi',
        filterJson: { cityRegency: 'Kota Bandung' },
      },
      user: stewardUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.recorded).toBe(true);
    expect(json.data.exportType).toBe('jamaah_list_csv');
  });
});
