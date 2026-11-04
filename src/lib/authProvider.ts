import { AuthProvider } from '@refinedev/core';
import { apiClient } from './apiClient';
import { PermissionCode, RoleCode, ROLE_PERMISSIONS } from '@server/permissions/constants';
import { canOpenPath, safeReturnPath } from '@server/permissions/navigation';
import { clearSession, getSessionToken, getSessionUser, storeSession, updateSessionUser } from './session';

export interface UserIdentity {
  id: string;
  authSubject: string;
  email: string;
  fullName: string;
  name: string;
  isActive: boolean;
  avatar?: string;
  roles: RoleCode[];
  permissions: PermissionCode[];
}

export function getIdentityPermissions(user: UserIdentity | null): PermissionCode[] {
  return [...new Set((user?.roles || []).flatMap((role) => ROLE_PERMISSIONS[role] || []))];
}

export const authProvider: AuthProvider = {
  login: async ({ email, password, rememberMe = false, returnTo }) => {
    try {
      const { data } = await apiClient<{ user: UserIdentity; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: String(email).trim().toLowerCase(), password, rememberMe }),
      });
      if (!data?.token || !data?.user?.isActive) throw new Error('Email atau kata sandi tidak cocok.');
      storeSession(data.token, data.user, rememberMe);
      const destination = safeReturnPath(returnTo);
      return { success: true, redirectTo: canOpenPath(destination, getIdentityPermissions(data.user)) ? destination : '/' };
    } catch (error: unknown) {
      return { success: false, error: { name: 'LoginError', message: error instanceof Error ? error.message : 'Gagal masuk. Silakan coba lagi.' } };
    }
  },
  logout: async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      clearSession();
    }
    return { success: true, redirectTo: '/login' };
  },
  check: async () => {
    if (!getSessionToken()) return { authenticated: false, redirectTo: '/login' };
    try {
      const { data } = await apiClient<{ user: UserIdentity }>('/auth/me');
      if (!data?.user?.id || !data.user.isActive) {
        clearSession();
        return { authenticated: false, redirectTo: '/login?reason=expired' };
      }
      updateSessionUser(data.user);
      return { authenticated: true };
    } catch (error: any) {
      if (error?.statusCode === 401 || error?.statusCode === 403) clearSession();
      return { authenticated: false, redirectTo: error?.statusCode === 0 || error?.statusCode >= 500 ? '/login?reason=connection' : '/login?reason=expired' };
    }
  },
  onError: async (error) => {
    if (error?.status === 401 || error?.statusCode === 401) {
      clearSession();
      return { logout: true, redirectTo: '/login?reason=expired' };
    }
    // Permission denials must not sign users out.
    return { error };
  },
  getPermissions: async () => getIdentityPermissions(getSessionUser<UserIdentity>()),
  getIdentity: async () => {
    const user = getSessionUser<UserIdentity>();
    return user ? { ...user, name: user.fullName || user.name || user.email } : null;
  },
};
