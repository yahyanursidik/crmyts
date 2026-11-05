import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPersonsRoutes } from '../../server/domain/persons/routes';
import * as client from '../../server/db/client';

const id = '018f0000-0000-0000-0000-000000000099';
const otherId = '018f0000-0000-0000-0000-000000000098';
const admin = {
  id: '018f0000-0000-0000-0000-000000000001',
  authSubject: 'admin',
  email: 'admin@example.test',
  fullName: 'Admin',
  roles: ['crm_admin' as const],
  permissions: ['persons.delete' as const],
  isActive: true,
};
const router = new Router();
registerPersonsRoutes(router);
const request = (path: string, method: string, body = {}, user = admin) =>
  router.handle({
    path,
    method: method as any,
    body,
    user,
    headers: {},
    query: {},
    params: {},
    requestId: 'archive-test',
  });
function database(people: any[]) {
  const values = vi.fn().mockResolvedValue(undefined);
  const set = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const tx = {
    query: { persons: { findMany: vi.fn().mockResolvedValue(people) } },
    update: vi.fn().mockReturnValue({ set }),
    insert: vi.fn().mockReturnValue({ values }),
    delete: vi.fn(),
  };
  const db = { transaction: vi.fn(async (fn: any) => fn(tx)) };
  vi.spyOn(client, 'getDb').mockReturnValue(db as any);
  return { db, tx, values, set };
}

describe('Reversible person archive', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('archives an existing person without deleting any related history', async () => {
    const { tx, set, values } = database([
      { id, fullName: 'Ahmad', isActive: true },
    ]);
    const response = await request(`/api/persons/${id}`, 'DELETE');
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data).toMatchObject({
      archived: true,
      success: true,
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
    expect(tx.delete).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        action: 'archive_person',
        entityId: id,
        beforeJson: expect.objectContaining({ isActive: true }),
      }),
    ]);
  });
  it('restores the same identity and its links', async () => {
    const { set, tx, values } = database([
      { id, fullName: 'Ahmad', isActive: false },
    ]);
    expect(
      (await request(`/api/persons/${id}/restore`, 'POST')).statusCode,
    ).toBe(200);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ action: 'restore_person', entityId: id }),
    ]);
    expect(tx.delete).not.toHaveBeenCalled();
  });
  it('returns 404 for an unavailable person', async () => {
    const { set } = database([]);
    expect((await request(`/api/persons/${id}`, 'DELETE')).statusCode).toBe(
      404,
    );
    expect(set).not.toHaveBeenCalled();
  });
  it('does not revive a profile already merged into another identity', async () => {
    const { set } = database([
      { id, fullName: 'Ahmad [MERGED -> Ahmad Utama]', isActive: false },
    ]);
    expect(
      (await request(`/api/persons/${id}/restore`, 'POST')).statusCode,
    ).toBe(409);
    expect(set).not.toHaveBeenCalled();
  });
  it('rejects archive and restore for a viewer', async () => {
    const viewer = {
      ...admin,
      roles: ['leadership_viewer' as any],
      permissions: ['persons.view_summary' as any],
    };
    const { set } = database([]);
    expect(
      (await request(`/api/persons/${id}`, 'DELETE', {}, viewer)).statusCode,
    ).toBe(403);
    expect(
      (await request(`/api/persons/${id}/restore`, 'POST', {}, viewer))
        .statusCode,
    ).toBe(403);
    expect(set).not.toHaveBeenCalled();
  });
  it('archives selected people atomically and audits each person', async () => {
    const { db, tx, values } = database([
      { id, fullName: 'Satu', isActive: true },
      { id: otherId, fullName: 'Dua', isActive: true },
    ]);
    const response = await request('/api/persons/bulk-delete', 'POST', {
      personIds: [id, otherId],
      confirmation: 'ARSIPKAN',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data).toMatchObject({
      archivedCount: 2,
      archivedPersonIds: [id, otherId],
    });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.delete).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ action: 'archive_person', entityId: id }),
        expect.objectContaining({
          action: 'archive_person',
          entityId: otherId,
        }),
      ]),
    );
  });
  it('makes no changes if any selected identity is unavailable', async () => {
    const { tx, values } = database([{ id, fullName: 'Satu', isActive: true }]);
    expect(
      (
        await request('/api/persons/bulk-delete', 'POST', {
          personIds: [id, otherId],
          confirmation: 'ARSIPKAN',
        })
      ).statusCode,
    ).toBe(409);
    expect(tx.update).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });
  it('requires an explicit bulk confirmation', async () => {
    const { tx } = database([]);
    expect(
      (
        await request('/api/persons/bulk-delete', 'POST', {
          personIds: [id],
          confirmation: 'hapus',
        })
      ).statusCode,
    ).toBe(400);
    expect(tx.update).not.toHaveBeenCalled();
  });
  it('does not report success when mandatory audit recording fails', async () => {
    const { values } = database([{ id, fullName: 'Satu', isActive: true }]);
    values.mockRejectedValueOnce(new Error('Audit store unavailable'));
    expect((await request(`/api/persons/${id}`, 'DELETE')).statusCode).toBe(
      500,
    );
  });
});
