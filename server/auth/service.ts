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
  'kajian@tarbiyahsunnah.id': {
    id: 'usr_kajian_003',
    authSubject: 'auth_kajian_003',
    email: 'kajian@tarbiyahsunnah.id',
    fullName: 'Abu Fulan (Admin Kajian)',
    isActive: true,
    roles: ['event_admin'],
    permissions: (ROLE_PERMISSIONS['event_admin'] || []) as PermissionCode[],
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
  'finance@tarbiyahsunnah.id': {
    id: 'usr_finance_002',
    authSubject: 'auth_finance_002',
    email: 'finance@tarbiyahsunnah.id',
    fullName: 'Ustadz Ahmad (Finance)',
    isActive: true,
    roles: ['finance_verifier'],
    permissions: (ROLE_PERMISSIONS['finance_verifier'] || []) as PermissionCode[],
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
  'cs@tarbiyahsunnah.id': {
    id: 'usr_cs_004',
    authSubject: 'auth_cs_004',
    email: 'cs@tarbiyahsunnah.id',
    fullName: 'Fulan (CS Officer)',
    isActive: true,
    roles: ['cs_officer'],
    permissions: (ROLE_PERMISSIONS['cs_officer'] || []) as PermissionCode[],
  },
  'fundraising@tarbiyahsunnah.id': {
    id: 'usr_fundraising_005',
    authSubject: 'auth_fundraising_005',
    email: 'fundraising@tarbiyahsunnah.id',
    fullName: 'Muhammad (Fundraising)',
    isActive: true,
    roles: ['fundraising_officer'],
    permissions: (ROLE_PERMISSIONS['fundraising_officer'] || []) as PermissionCode[],
  },
  'waqf@tarbiyahsunnah.id': {
    id: 'usr_waqf_006',
    authSubject: 'auth_waqf_006',
    email: 'waqf@tarbiyahsunnah.id',
    fullName: 'Abdullah (Wakaf Officer)',
    isActive: true,
    roles: ['waqf_officer'],
    permissions: (ROLE_PERMISSIONS['waqf_officer'] || []) as PermissionCode[],
  },
  'pimpinan@tarbiyahsunnah.id': {
    id: 'usr_pimpinan_007',
    authSubject: 'auth_pimpinan_007',
    email: 'pimpinan@tarbiyahsunnah.id',
    fullName: 'Dewan Pembina YTS',
    isActive: true,
    roles: ['leadership_viewer'],
    permissions: (ROLE_PERMISSIONS['leadership_viewer'] || []) as PermissionCode[],
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
 * Registered Credentials & Passwords
 * Only authorized passwords will be accepted (e.g. admin123 for administrator accounts).
 */
const VALID_CREDENTIALS: Record<string, string> = {
  'admin@tarbiyahsunnah.id': 'admin123',
  'crm_admin@tarbiyahsunnah.id': 'admin123',
  'kajian@tarbiyahsunnah.id': 'admin123',
  'event_admin@tarbiyahsunnah.id': 'admin123',
  'finance@tarbiyahsunnah.id': 'admin123',
  'finance_verifier@tarbiyahsunnah.id': 'admin123',
  'cs@tarbiyahsunnah.id': 'admin123',
  'fundraising@tarbiyahsunnah.id': 'admin123',
  'waqf@tarbiyahsunnah.id': 'admin123',
  'pimpinan@tarbiyahsunnah.id': 'admin123',
};

/**
 * Login user and issue signed session token with strict password validation
 */
export async function loginUser(email: string, password: string): Promise<LoginResult | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedPassword = (password || '').trim();

  // 1. Strict password validation:
  // Must strictly match the configured password (admin123)
  const expectedPassword = VALID_CREDENTIALS[normalizedEmail];
  if (!expectedPassword || trimmedPassword !== expectedPassword) {
    console.warn(`[Login Failed]: Invalid password attempt for ${normalizedEmail}`);
    return null;
  }

  // 2. Resolve user profile
  const user = await resolveUserByEmail(normalizedEmail);

  if (!user) {
    return null;
  }

  if (!user.isActive) {
    return null;
  }

  // 3. Generate signed session token
  const token = createSessionToken({
    userId: user.id,
    authSubject: user.authSubject,
    email: user.email,
  });

  // 4. Update last login timestamp if database is available
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
