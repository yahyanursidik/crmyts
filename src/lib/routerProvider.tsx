import {
  useNavigate,
  useLocation,
  useParams,
  Link as RouterLink,
  NavLink as RouterNavLink,
  Navigate,
  Outlet,
} from 'react-router';
import type { RouterProvider, GoConfig } from '@refinedev/core';

export const routerProvider: RouterProvider = {
  go: () => {
    const navigate = useNavigate();
    return ({ to, type = 'push', query }: GoConfig) => {
      if (!to) return;
      let url = to;
      if (query && Object.keys(query).length > 0) {
        const search = new URLSearchParams();
        Object.entries(query).forEach(([k, v]) => {
          if (v !== undefined && v !== null) search.set(k, String(v));
        });
        url = `${to}?${search.toString()}`;
      }
      navigate(url, { replace: type === 'replace' });
    };
  },

  back: () => {
    const navigate = useNavigate();
    return () => {
      navigate(-1);
    };
  },

  parse: () => {
    const location = useLocation();
    const params = useParams();

    return () => {
      const parts = location.pathname.split('/').filter(Boolean);
      const resourceName = parts[0] || 'dashboard';

      return {
        resource: { name: resourceName },
        action: (parts[1] || 'list') as any,
        id: params.id,
        pathname: location.pathname,
        params: {
          ...params,
        },
      };
    };
  },

  Link: RouterLink as any,
};

export {
  RouterLink as Link,
  RouterNavLink as NavLink,
  useNavigate,
  useLocation,
  useParams,
  Navigate,
  Outlet,
};
