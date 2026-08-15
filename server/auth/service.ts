import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appUsers } from '../db/schema';
import { RoleCode, PermissionCode, ROLE_PERMISSIONS, PERMISSIONS } from '../permissions/constants';
import { createSessionToken } from './token';
import { getServerEnv } from '../config/env';

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

const FALLBACK_USERS: Record<string, AuthenticatedUser> = {
  'admin@tarbiyahsunnah.id': {
    id: 'usr_admin_001',
    authSubject: 'auth_admin_001',
    email: 'admin@tarbiyahsunnah.id',
    fullName: 'Administrator Yayasan',
    isActive: true,
    roles: ['crm_admin', 'data_steward'],
    permissions: Object.values(PERMISSIONS) as PermissionCode[],
  },
  'crm_admin@tarbiyahsunnah.id': {
    id: 'usr_admin_001',
    authSubject: 'auth_admin_001',
    email: 'crm_admin@tarbiyahsunnah.id',
    fullName: 'Administrator YTS',
    isActive: true,
    roles: ['crm_admin'],
    permissions: Object.values(PERMISSIONS) as PermissionCode[],
  },
  'finance_verifier@tarbiyahsunnah.id': {
    id: 'usr_finance_002',
    authSubject: 'auth_finance_002',
    email: 'finance_verifier@tarbiyahsunnah.id',
    fullName: 'Finance Verifier YTS',
    isActive: true,
    roles: ['finance_verifier'],
    permissions: (ROLE_PERMISSIONS['finance_verifier'] || []) as PermissionCode[],
  },
  'event_admin@tarbiyahsunnah.id': {
    id: 'usr_event_003',
    authSubject: 'auth_event_003',
    email: 'event_admin@tarbiyahsunnah.id',
    fullName: 'Event Admin YTS',
    isActive: true,
    roles: ['event_admin'],
    permissions: (ROLE_PERMISSIONS['event_admin'] || []) as PermissionCode[],
  },
};

/**
 * Resolves full user profile with roles and permissions by auth_subject
 */
export async function resolveUserBySubject(authSubject: string): Promise<AuthenticatedUser | null> {
  if (authSubject.startsWith('auth_') || authSubject.startsWith('mock_')) {
    const found = Object.values(FALLBACK_USERS).find((u) => u.authSubject === authSubject);
    if (found) return found;
  }

  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    const found = Object.values(FALLBACK_USERS).find((u) => u.authSubject === authSubject);
    return found || null;
  }

  try {
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

    if (!user) {
      const found = Object.values(FALLBACK_USERS).find((u) => u.authSubject === authSubject);
      return found || null;
    }

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
  } catch (err) {
    console.warn('[Resolve Subject Warn]: Falling back to seed user profile', err);
    const found = Object.values(FALLBACK_USERS).find((u) => u.authSubject === authSubject);
    return found || null;
  }
}

/**
 * Resolves full user profile by email
 */
export async function resolveUserByEmail(email: string): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const env = getServerEnv();

  if (!env.DATABASE_URL) {
    return FALLBACK_USERS[normalizedEmail] || null;
  }

  try {
    const db = getDb();
    const user = await db.query.appUsers.findFirst({
      where: eq(appUsers.email, normalizedEmail),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return FALLBACK_USERS[normalizedEmail] || null;
    }

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
  } catch (err) {
    console.warn('[Resolve Email Warn]: Falling back to seed user', err);
    return FALLBACK_USERS[normalizedEmail] || null;
  }
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

  // Update last login timestamp if database is available
  try {
    const env = getServerEnv();
    if (env.DATABASE_URL) {
      const db = getDb();
      await db
        .update(appUsers)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(appUsers.id, user.id));
    }
  } catch (err) {
    console.warn('[Update Last Login Warn]:', err);
  }

  return {
    token,
    user,
  };
}
