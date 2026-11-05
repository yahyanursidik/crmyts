import { afterEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import * as client from '../../server/db/client';
import { persons } from '../../server/db/schema';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import { eventDb } from '../helpers/eventDb';
const id = '10000000-0000-4000-8000-000000000001';
const attendanceId = '10000000-0000-4000-8000-000000000002';
const person = {
  id,
  fullName: 'Anggota keluarga',
  phoneE164: '+6281234567890-fam-2',
  email: null,
  cityRegency: null,
};
const attendance = {
  id: attendanceId,
  personId: id,
  person,
  ticketCode: 'YTS-1234',
  status: 'attended',
};
const router = new Router();
registerEventsRoutes(router);
afterEach(() => vi.restoreAllMocks());
function fixture(owner: unknown = null) {
  let patch: Record<string, unknown> = {};
  const db = eventDb({
    query: {
      eventAttendance: { findFirst: vi.fn().mockResolvedValue(attendance) },
      persons: { findFirst: vi.fn().mockResolvedValue(owner) },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn((value) => {
        patch = value;
        return {
          where: vi
            .fn()
            .mockReturnValue({
              returning: vi.fn(async () => [{ ...person, ...patch }]),
            }),
        };
      }),
    }),
  });
  vi.spyOn(client, 'getDb').mockReturnValue(db as any);
  return { db, patch: () => patch };
}
function edit(phone: string) {
  return router.handle({
    method: 'PATCH',
    path: `/api/events/${id}/attendances/${attendanceId}`,
    params: {},
    query: {},
    headers: {},
    requestId: 'virtual-family-edit',
    user: {
      id,
      authSubject: 'test',
      email: 'admin@example.test',
      fullName: 'Pengelola',
      isActive: true,
      roles: [ROLES.CRM_ADMIN],
      permissions: [PERMISSIONS.ATTENDANCE_MANAGE],
    },
    body: {
      fullName: 'Nama Keluarga Diperbaiki',
      phone,
      email: '',
      cityRegency: '',
    },
  });
}
describe('Participant corrections preserve family identity', () => {
  it('changes a name without normalizing the existing virtual phone or changing the ticket', async () => {
    const { db, patch } = fixture();
    const response = await edit(person.phoneE164);
    expect(response.statusCode).toBe(200);
    expect(patch()).not.toHaveProperty('phoneE164');
    expect(JSON.parse(response.body).data.participant).toMatchObject({
      personPhone: person.phoneE164,
      ticketCode: attendance.ticketCode,
    });
    expect(db.update).toHaveBeenCalledWith(persons);
    expect((db as any).insert).toHaveBeenCalledOnce();
  });
  it('rejects an explicitly changed phone containing letters before updating the master profile', async () => {
    const { db } = fixture();
    expect((await edit('abc123456789')).statusCode).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });
  it('rejects taking a contact owned by a different Jamaah profile, including another event', async () => {
    const { db } = fixture({ id: attendanceId });
    expect((await edit('+6281999999999')).statusCode).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });
});
