import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { loginUser, resolveUserBySubject } from '../../server/auth/service';
import { hashPassword } from '../../server/auth/password';
import { verifySessionToken } from '../../server/auth/token';
import { ROLES } from '../../server/permissions/constants';
import * as client from '../../server/db/client';

const password = ' StafYTS#2026 ';
let passwordHash: string;
let db: any;
const user = { id: '018f0000-0000-7000-8000-000000000001', authSubject: 'sub_staf', email: 'staf@yts.id', fullName: 'Staf YTS', isActive: true, userRoles: [{ role: { code: ROLES.CS_OFFICER } }] };
beforeAll(async () => { passwordHash = await hashPassword(password); });
beforeEach(() => {
  db = {
    query: { appUsers: { findFirst: vi.fn().mockResolvedValue(user) }, appUserCredentials: { findFirst: vi.fn().mockResolvedValue({ userId: user.id, passwordHash, sessionVersion: 2 }) } },
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  };
  vi.spyOn(client, 'getDb').mockReturnValue(db);
});
afterEach(() => vi.restoreAllMocks());

describe('Staff authentication uses provisioned database credentials', () => {
  it.each(Object.values(ROLES))('allows a provisioned active account for %s', async (role) => {
    db.query.appUsers.findFirst.mockResolvedValue({ ...user, userRoles: [{ role: { code: role } }] });
    const result = await loginUser(' STAF@YTS.ID ', password);
    expect(result?.user.roles).toEqual([role]);
    expect(result?.user).not.toHaveProperty('passwordHash');
    expect(verifySessionToken(result!.token).payload?.sessionVersion).toBe(2);
  });
  it('preserves spaces in passwords and rejects a wrong password', async () => {
    expect(await loginUser(user.email, password.trim())).toBeNull();
    expect(await loginUser(user.email, 'wrong')).toBeNull();
    expect(db.update).not.toHaveBeenCalled();
  });
  it('rejects accounts without credentials, without roles or suspended', async () => {
    db.query.appUserCredentials.findFirst.mockResolvedValue(null);
    expect(await loginUser(user.email, password)).toBeNull();
    db.query.appUsers.findFirst.mockResolvedValue({ ...user, isActive: false });
    expect(await loginUser(user.email, password)).toBeNull();
    db.query.appUsers.findFirst.mockResolvedValue({ ...user, userRoles: [] });
    expect(await loginUser(user.email, password)).toBeNull();
  });
  it('does not fall back to a seed administrator when the database fails', async () => {
    db.query.appUsers.findFirst.mockRejectedValue(new Error('database unavailable'));
    await expect(loginUser('admin@tarbiyahsunnah.id', 'admin123')).rejects.toThrow('database unavailable');
  });
  it('issues a 24-hour session or a remembered 14-day session', async () => {
    const normal = verifySessionToken((await loginUser(user.email, password))!.token).payload!;
    const remembered = verifySessionToken((await loginUser(user.email, password, true))!.token).payload!;
    expect(normal.exp - normal.iat).toBe(86400);
    expect(remembered.exp - remembered.iat).toBe(86400 * 14);
  });
  it('rejects old session versions after logout or password reset', async () => {
    expect(await resolveUserBySubject(user.authSubject, 1)).toBeNull();
    expect((await resolveUserBySubject(user.authSubject, 2))?.id).toBe(user.id);
  });
});
