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
});
