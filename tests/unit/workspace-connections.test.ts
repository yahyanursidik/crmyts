import { describe, it, expect, vi, afterEach } from 'vitest';
import { Router } from '../../server/http/router';
import { registerReportsRoutes } from '../../server/domain/reports/routes';
import { registerSettingsRoutes } from '../../server/domain/settings/routes';
import { getFoundation, saveFoundation } from '../../server/domain/settings/foundation';
import { hashPassword, verifyPassword } from '../../server/auth/password';
import { csvCell, recordsToCsv } from '../../server/lib/csv';
import { successResponse } from '../../server/http/response';
import { ROLES, ROLE_PERMISSIONS } from '../../server/permissions/constants';
import * as client from '../../server/db/client';
import * as audit from '../../server/audit/service';
import * as email from '../../server/email/service';
import { appUserCredentials } from '../../server/db/schema';

const admin = { id: '018f0000-0000-7000-8000-000000000001', authSubject: 'sub-admin', email: 'admin@yts.test', fullName: 'Admin Test', isActive: true, roles: [ROLES.CRM_ADMIN], permissions: [...ROLE_PERMISSIONS.crm_admin] };
const context = (path: string, body: unknown = {}) => ({ path, method: 'POST', query: {}, params: {}, headers: {}, body, user: admin, requestId: 'account-test' });
afterEach(() => vi.restoreAllMocks());

describe('Provisioning and password changes persist credentials', () => {
  it('stores a hashed initial password atomically with the new staff account', async () => {
    vi.spyOn(audit, 'logAuditEvent').mockResolvedValue(undefined);
    vi.spyOn(email, 'sendStaffWelcomeEmail').mockResolvedValue({ success: true });
    const values: Array<{ table: unknown; data: any }> = [];
    const tx = {
      query: { roles: { findMany: vi.fn().mockResolvedValue([{ id: 'role-cs', code: ROLES.CS_OFFICER }]) } },
      insert: (table: unknown) => ({ values: (data: any) => { values.push({ table, data }); return { returning: async () => [{ ...admin, id: 'new-staff', email: 'new@yts.test' }] }; } }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue({ query: { appUsers: { findFirst: async () => null } }, transaction: async (callback: any) => callback(tx) } as any);
    const router = new Router(); registerSettingsRoutes(router);
    const response = await router.handle(context('/api/settings/users', { email: 'new@yts.test', fullName: 'Staf Baru', roleCodes: [ROLES.CS_OFFICER], password: 'Staff#2026' }));
    expect(response.statusCode).toBe(201);
    const credential = values.find((entry) => entry.table === appUserCredentials)!.data;
    expect(credential.passwordHash).not.toBe('Staff#2026'); expect(await verifyPassword('Staff#2026', credential.passwordHash)).toBe(true);
    expect(response.body).not.toContain(credential.passwordHash); expect(response.body).not.toContain('Staff#2026');
  });
  it('verifies the old password and revokes prior sessions when changing it', async () => {
    vi.spyOn(audit, 'logAuditEvent').mockResolvedValue(undefined);
    const hash = await hashPassword('OldPassword#1'); const set = vi.fn().mockReturnValue({ where: async () => [] });
    vi.spyOn(client, 'getDb').mockReturnValue({ query: { appUserCredentials: { findFirst: async () => ({ passwordHash: hash, sessionVersion: 3 }) } }, update: () => ({ set }) } as any);
    const router = new Router(); registerSettingsRoutes(router);
    const wrong = await router.handle(context('/api/settings/change-password', { currentPassword: 'wrong', newPassword: 'NewPassword#2' }));
    expect(wrong.statusCode).toBe(400); expect(set).not.toHaveBeenCalled();
    const result = await router.handle(context('/api/settings/change-password', { currentPassword: 'OldPassword#1', newPassword: 'NewPassword#2' }));
    expect(result.statusCode).toBe(200); expect(JSON.parse(result.body).data.reauthenticate).toBe(true);
    expect(await verifyPassword('NewPassword#2', set.mock.calls[0]![0].passwordHash)).toBe(true);
    expect(set.mock.calls[0]![0].sessionVersion).toBeDefined();
  });
  it('rejects unknown staff roles before starting account creation', async () => {
    const router = new Router(); registerSettingsRoutes(router); const getDb = vi.spyOn(client, 'getDb');
    const result = await router.handle(context('/api/settings/users', { email: 'new@yts.test', fullName: 'Staf Baru', roleCodes: ['super_admin'], password: 'Staff#2026' }));
    expect(result.statusCode).toBe(400); expect(getDb).not.toHaveBeenCalled();
  });
});

describe('Reports return actual downloadable CSV', () => {
  it('returns report data, a safe CSV filename, and the true audited row count', async () => {
    const log = vi.spyOn(audit, 'logExportEvent').mockResolvedValue(undefined);
    const router = new Router();
    router.get('/api/reports/donations-reconciliation', async () => successResponse({ items: [{ donorName: '=1+1', amountRupiah: 1000 }, { donorName: 'Jamaah, Bandung', amountRupiah: 2000 }], pagination: { totalPages: 1 } }));
    registerReportsRoutes(router);
    const finance = { ...admin, roles: [ROLES.FINANCE_VERIFIER], permissions: [...ROLE_PERMISSIONS.finance_verifier] };
    const response = await router.handle({ ...context('/api/reports/export-csv', { reportType: 'donations_reconciliation', reason: 'Rekonsiliasi bulanan' }), user: finance });
    expect(response.statusCode).toBe(200); const data = JSON.parse(response.body).data;
    expect(data.csvContent).toContain('1000'); expect(data.csvContent).toContain('"\'=1+1"'); expect(data.csvContent).toContain('"Jamaah, Bandung"');
    expect(data.filename).toMatch(/\.csv$/); expect(data.rowCount).toBe(2); expect(log).toHaveBeenCalledWith(expect.objectContaining({ rowCount: 2 }));
    expect(data).not.toHaveProperty('downloadUrl');
  });
  it('neutralizes spreadsheet formulas and quotes multiline cells', () => {
    expect(csvCell('@command')).toBe('"\'@command"'); expect(csvCell('A"B\nC')).toBe('"A""B\nC"'); expect(recordsToCsv([])).toContain('Tidak ada data');
  });
});

describe('Foundation account settings persist as one shared record', () => {
  it('reads the saved record used by settings, public portal and email confirmations', async () => {
    const data = { foundationName: 'YTS', bankAccounts: [{ bankName: 'Bank Test', accountNumber: 'TEST-001', accountHolder: 'YTS', branch: 'Test', category: 'infaq' as const }] };
    const update = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(client, 'getDb').mockReturnValue({ query: { foundationSettings: { findFirst: async () => ({ data }) } }, insert: () => ({ values: () => ({ onConflictDoUpdate: update }) }) } as any);
    const settings = await getFoundation(); expect(settings.bankAccounts).toEqual(data.bankAccounts);
    await saveFoundation(settings); expect(update).toHaveBeenCalledWith(expect.objectContaining({ set: expect.objectContaining({ data: settings }) }));
  });
  it('never invents bank accounts when none have been configured', async () => {
    vi.spyOn(client, 'getDb').mockReturnValue({ query: { foundationSettings: { findFirst: async () => null } } } as any);
    expect((await getFoundation()).bankAccounts).toEqual([]);
  });
});
