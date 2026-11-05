import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import { usePermissions } from '@refinedev/core';
import {
  PERMISSIONS,
  type PermissionCode,
} from '@server/permissions/constants';

export interface PersonContext {
  isActive?: boolean;
  id: string;
  fullName: string;
  phoneE164?: string | null;
  cityRegency?: string | null;
}
export function usePersonContext() {
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const [params, setParams] = useSearchParams();
  const personId = params.get('personId') || '';
  const query = useQuery({
    queryKey: ['person-context', personId],
    queryFn: () =>
      apiClient<PersonContext>(
        `/persons/${encodeURIComponent(personId)}/summary`,
      ),
    enabled: Boolean(personId),
    staleTime: 30000,
    retry: false,
  });
  const clear = () =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('personId');
        return next;
      },
      { replace: true },
    );
  return {
    canProfile:
      permissions.includes(PERMISSIONS.PERSONS_VIEW) ||
      permissions.includes(PERMISSIONS.PERSONS_VIEW_OPERATIONAL),
    personId,
    person: query.data?.data,
    loading: query.isFetching,
    error: query.error,
    clear,
  };
}
