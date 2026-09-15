import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPersonsRoutes } from '../../server/domain/persons/routes';
import * as client from '../../server/db/client';

describe('DELETE /api/persons/:id API', () => {
  const router = new Router();
  registerPersonsRoutes(router);

  const mockAdminUser = {
    id: '018f0000-0000-0000-0000-000000000001',
    authSubject: 'auth_admin_1',
    email: 'admin@tarbiyahsunnah.or.id',
    fullName: 'Admin CRM',
    roles: ['crm_admin' as const],
    permissions: ['persons.list' as const, 'persons.view' as const, 'persons.edit' as const, 'persons.delete' as const],
    isActive: true,
  };

  it('deletes an existing person and logs an audit trail', async () => {
    const mockPerson = {
      id: '018f0000-0000-0000-0000-000000000099',
      fullName: 'Ahmad bin Fulan',
      phoneE164: '+6281234567890',
      email: 'ahmad@example.com',
    };

    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: mockPerson.id }]),
    });
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ id: 'audit_1' }]),
    });

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(mockPerson),
        },
      },
      delete: mockDelete,
      insert: mockInsert,
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: `/api/persons/${mockPerson.id}`,
      method: 'DELETE',
      headers: {},
      query: {},
      params: { id: mockPerson.id },
      body: {},
      user: mockAdminUser,
      requestId: 'req_delete_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.success).toBe(true);
    expect(body.data.message).toContain('Ahmad bin Fulan berhasil dihapus');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns 404 if person does not exist', async () => {
    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/persons/018f0000-0000-0000-0000-000000000999',
      method: 'DELETE',
      headers: {},
      query: {},
      params: { id: '018f0000-0000-0000-0000-000000000999' },
      body: {},
      user: mockAdminUser,
      requestId: 'req_delete_404',
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 if user lacks persons.delete permission', async () => {
    const viewerUser = {
      id: '018f0000-0000-0000-0000-000000000002',
      authSubject: 'auth_viewer_1',
      email: 'viewer@tarbiyahsunnah.or.id',
      fullName: 'Leadership Viewer',
      roles: ['leadership_viewer' as const],
      permissions: ['persons.view_summary' as const],
      isActive: true,
    };

    const res = await router.handle({
      path: '/api/persons/018f0000-0000-0000-0000-000000000099',
      method: 'DELETE',
      headers: {},
      query: {},
      params: { id: '018f0000-0000-0000-0000-000000000099' },
      body: {},
      user: viewerUser,
      requestId: 'req_delete_403',
    });

    expect(res.statusCode).toBe(403);
  });

  it('deletes selected people atomically and records an audit entry per person', async () => {
    const selectedPeople = [
      { id: '018f0000-0000-0000-0000-000000000101', fullName: 'Ahmad Satu', phoneE164: '+6281111111111', email: null },
      { id: '018f0000-0000-0000-0000-000000000102', fullName: 'Fatimah Dua', phoneE164: '+6281222222222', email: null },
    ];
    const txDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const auditValues = vi.fn().mockResolvedValue(undefined);
    const tx = {
      query: { persons: { findMany: vi.fn().mockResolvedValue(selectedPeople) } },
      delete: txDelete,
      insert: vi.fn().mockReturnValue({ values: auditValues }),
    };
    const mockDb = { transaction: vi.fn(async (callback) => callback(tx)) };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/persons/bulk-delete',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: { personIds: selectedPeople.map((person) => person.id), confirmation: 'HAPUS' },
      user: mockAdminUser,
      requestId: 'req_bulk_delete_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.deletedCount).toBe(2);
    expect(body.data.deletedPersonIds).toEqual(selectedPeople.map((person) => person.id));
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(txDelete).toHaveBeenCalledTimes(1);
    expect(auditValues).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ action: 'bulk_delete_person', entityId: selectedPeople[0]!.id }),
      expect.objectContaining({ action: 'bulk_delete_person', entityId: selectedPeople[1]!.id }),
    ]));
  });

  it('does not delete any person when a selected record is no longer available', async () => {
    const existingId = '018f0000-0000-0000-0000-000000000103';
    const missingId = '018f0000-0000-0000-0000-000000000104';
    const txDelete = vi.fn();
    const tx = {
      query: { persons: { findMany: vi.fn().mockResolvedValue([{ id: existingId, fullName: 'Masih Ada', phoneE164: null, email: null }]) } },
      delete: txDelete,
      insert: vi.fn(),
    };
    vi.spyOn(client, 'getDb').mockReturnValue({ transaction: vi.fn(async (callback) => callback(tx)) } as any);

    const res = await router.handle({
      path: '/api/persons/bulk-delete',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: { personIds: [existingId, missingId], confirmation: 'HAPUS' },
      user: mockAdminUser,
      requestId: 'req_bulk_delete_conflict',
    });

    expect(res.statusCode).toBe(409);
    expect(txDelete).not.toHaveBeenCalled();
  });

  it('rejects bulk deletion without the required confirmation value', async () => {
    const res = await router.handle({
      path: '/api/persons/bulk-delete',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: { personIds: ['018f0000-0000-0000-0000-000000000105'], confirmation: 'hapus' },
      user: mockAdminUser,
      requestId: 'req_bulk_delete_confirmation',
    });

    expect(res.statusCode).toBe(400);
  });
});
