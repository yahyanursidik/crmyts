import React from 'react';
import { usePermissions } from '@refinedev/core';
import { PermissionCode } from '@server/permissions/constants';

interface PermissionGateProps {
  permission: PermissionCode | PermissionCode[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  requireAll = false,
  children,
  fallback = null,
}) => {
  const { data: userPermissions = [] } = usePermissions<PermissionCode[]>({});

  const requiredPerms = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? requiredPerms.every((p) => (userPermissions as PermissionCode[]).includes(p))
    : requiredPerms.some((p) => (userPermissions as PermissionCode[]).includes(p));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
