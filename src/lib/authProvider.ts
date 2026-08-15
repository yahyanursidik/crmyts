import { AuthProvider } from '@refinedev/core';
import { apiClient } from './apiClient';
import { PermissionCode, RoleCode, ROLES, PERMISSIONS, ROLE_PERMISSIONS } from '@server/permissions/constants';

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

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const response = await apiClient<{ user: UserIdentity; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.data?.token && response.data?.user) {
        localStorage.setItem('crm_user_token', response.data.token);
        localStorage.setItem('crm_user_session', JSON.stringify(response.data.user));
        return {
          success: true,
          redirectTo: '/',
        };
      }

      return {
        success: false,
        error: {
          name: 'LoginError',
          message: 'Email atau password tidak valid',
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          name: 'LoginError',
          message: err?.message || 'Login gagal. Periksa kredensial Anda.',
        },
      };
    }
  },

  logout: async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      localStorage.removeItem('crm_user_token');
      localStorage.removeItem('crm_user_session');
    }
    return {
      success: true,
      redirectTo: '/login',
    };
  },

  check: async () => {
    const token = localStorage.getItem('crm_user_token');
    const session = localStorage.getItem('crm_user_session');

    if (!token || !session) {
      return {
        authenticated: false,
        redirectTo: '/login',
      };
    }

    try {
      const parsed = JSON.parse(session);
      if (parsed?.id && parsed?.isActive) {
        return {
          authenticated: true,
        };
      }
    } catch {
      localStorage.removeItem('crm_user_token');
      localStorage.removeItem('crm_user_session');
    }

    return {
      authenticated: false,
      redirectTo: '/login',
    };
  },

  onError: async (error) => {
    if (error?.status === 401 || error?.statusCode === 401 || error?.status === 403 || error?.statusCode === 403) {
      localStorage.removeItem('crm_user_token');
      localStorage.removeItem('crm_user_session');
      return {
        logout: true,
        redirectTo: '/login',
      };
    }
    return { error };
  },

  getPermissions: async () => {
    const session = localStorage.getItem('crm_user_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.roles?.includes(ROLES.CRM_ADMIN) || parsed.roles?.includes('crm_admin')) {
          return Object.values(PERMISSIONS);
        }
        if (parsed.roles && Array.isArray(parsed.roles)) {
          const perms = new Set<PermissionCode>(parsed.permissions || []);
          for (const r of parsed.roles) {
            const rolePerms = ROLE_PERMISSIONS[r as RoleCode];
            if (rolePerms) {
              rolePerms.forEach((p) => perms.add(p));
            }
          }
          return Array.from(perms);
        }
        return parsed.permissions || [];
      } catch {
        return [];
      }
    }
    return [];
  },

  getIdentity: async () => {
    const session = localStorage.getItem('crm_user_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        return {
          ...parsed,
          name: parsed.fullName || parsed.name || parsed.email,
        };
      } catch {
        return null;
      }
    }
    return null;
  },
};
