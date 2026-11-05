import { useSearchParams } from 'react-router';
import { usePermissions } from '@refinedev/core';
import type { PermissionCode } from '@server/permissions/constants';

/** URL-driven form state survives authentication rechecks and lazy-route remounts. */
export function useCreateIntent(permission: PermissionCode) {
  const [params, setParams] = useSearchParams();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const requested = params.get('action') === 'create' || params.get('new') === '1';
  const clear = () => {
    if (!requested) return;
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('action'); next.delete('new');
      return next;
    }, { replace: true });
  };
  return { active: requested && permissions.includes(permission), clear };
}
