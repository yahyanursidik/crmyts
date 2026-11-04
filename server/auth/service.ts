import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appUsers, appUserCredentials } from '../db/schema';
import { RoleCode, PermissionCode, ROLE_PERMISSIONS } from '../permissions/constants';
import { createSessionToken } from './token';
import { verifyPassword } from './password';

export interface AuthenticatedUser {
  id: string;
  authSubject: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: RoleCode[];
  permissions: PermissionCode[];
}
export interface LoginResult { token: string; user: AuthenticatedUser; }

function profile(user: { id: string; authSubject: string; email: string; fullName: string; isActive: boolean; userRoles: Array<{ role: { code: string } }> }): AuthenticatedUser {
  const roles = user.userRoles.map((assignment) => assignment.role.code).filter((role): role is RoleCode => Object.hasOwn(ROLE_PERMISSIONS, role));
  return { id: user.id, authSubject: user.authSubject, email: user.email, fullName: user.fullName, isActive: user.isActive, roles, permissions: [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]))] };
}

export async function resolveUserBySubject(authSubject: string, sessionVersion?: number): Promise<AuthenticatedUser | null> {
  const db = getDb();
  const user = await db.query.appUsers.findFirst({ where: eq(appUsers.authSubject, authSubject), with: { userRoles: { with: { role: true } } } });
  if (!user) return null;
  if (sessionVersion !== undefined) {
    const credential = await db.query.appUserCredentials.findFirst({ where: eq(appUserCredentials.userId, user.id) });
    if (!credential || credential.sessionVersion !== sessionVersion) return null;
  }
  return profile(user);
}

export async function resolveUserByEmail(email: string): Promise<AuthenticatedUser | null> {
  const user = await getDb().query.appUsers.findFirst({ where: eq(appUsers.email, email.toLowerCase().trim()), with: { userRoles: { with: { role: true } } } });
  return user ? profile(user) : null;
}

export async function loginUser(email: string, password: string, rememberMe = false): Promise<LoginResult | null> {
  const db = getDb();
  const user = await resolveUserByEmail(email);
  if (!user?.isActive || !user.roles.length) return null;
  const credential = await db.query.appUserCredentials.findFirst({ where: eq(appUserCredentials.userId, user.id) });
  // No seed-user fallback when the database is missing or unavailable.
  if (!credential || !await verifyPassword(password, credential.passwordHash)) return null;
  const token = createSessionToken({ userId: user.id, authSubject: user.authSubject, email: user.email, sessionVersion: credential.sessionVersion }, rememberMe ? 86400 * 14 : 86400);
  await db.update(appUsers).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(appUsers.id, user.id));
  return { token, user };
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await getDb().update(appUserCredentials).set({ sessionVersion: sql`${appUserCredentials.sessionVersion} + 1`, updatedAt: new Date() }).where(eq(appUserCredentials.userId, userId));
}
