import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appUsers } from '../db/schema';
import { RoleCode, PermissionCode, ROLE_PERMISSIONS } from '../permissions/constants';
import { createSessionToken } from './token';

export interface AuthenticatedUser {
  id: string;
  authSubject: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: RoleCode[];
  permissions: PermissionCode[];
}

export interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

/**
 * Resolves full user profile with roles and permissions by auth_subject
 */
export async function resolveUserBySubject(authSubject: string): Promise<AuthenticatedUser | null> {
  const db = getDb();

  const user = await db.query.appUsers.findFirst({
    where: eq(appUsers.authSubject, authSubject),
    with: {
      userRoles: {
        with: {
          role: true,
        },
      },
    },
  });

  if (!user) return null;

  const assignedRoles: RoleCode[] = user.userRoles.map((ur) => ur.role.code as RoleCode);

  // Compute unique permissions across all assigned roles
  const permissionsSet = new Set<PermissionCode>();
  assignedRoles.forEach((roleCode) => {
    const rolePerms = ROLE_PERMISSIONS[roleCode];
    if (rolePerms) {
      rolePerms.forEach((p) => permissionsSet.add(p));
    }
  });

  return {
    id: user.id,
    authSubject: user.authSubject,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    roles: assignedRoles,
    permissions: Array.from(permissionsSet),
  };
}

/**
 * Resolves full user profile by email
 */
export async function resolveUserByEmail(email: string): Promise<AuthenticatedUser | null> {
  const db = getDb();

  const user = await db.query.appUsers.findFirst({
    where: eq(appUsers.email, email.toLowerCase().trim()),
    with: {
      userRoles: {
        with: {
          role: true,
        },
      },
    },
  });

  if (!user) return null;

  const assignedRoles: RoleCode[] = user.userRoles.map((ur) => ur.role.code as RoleCode);

  const permissionsSet = new Set<PermissionCode>();
  assignedRoles.forEach((roleCode) => {
    const rolePerms = ROLE_PERMISSIONS[roleCode];
    if (rolePerms) {
      rolePerms.forEach((p) => permissionsSet.add(p));
    }
  });

  return {
    id: user.id,
    authSubject: user.authSubject,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    roles: assignedRoles,
    permissions: Array.from(permissionsSet),
  };
}

/**
 * Login user and issue signed session token
 */
export async function loginUser(email: string, _password: string): Promise<LoginResult | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await resolveUserByEmail(normalizedEmail);

  if (!user) {
    return null;
  }

  // Generate session token
  const token = createSessionToken({
    userId: user.id,
    authSubject: user.authSubject,
    email: user.email,
  });

  // Update last login timestamp
  const db = getDb();
  await db
    .update(appUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(appUsers.id, user.id));

  return {
    token,
    user,
  };
}
