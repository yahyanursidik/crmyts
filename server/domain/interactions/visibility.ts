import { eq, or } from 'drizzle-orm';
import { interactions } from '../../db/schema';
import {
  hasPermission,
  PERMISSIONS,
  type RoleCode,
} from '../../permissions/constants';

/** Restricted communication is visible to its responsible staff and authorized readers. */
export function interactionVisibility(roles: RoleCode[], userId: string) {
  return hasPermission(roles, PERMISSIONS.SENSITIVE_NOTES_VIEW)
    ? undefined
    : or(
        eq(interactions.sensitivityLevel, 'standard'),
        eq(interactions.ownerUserId, userId),
        eq(interactions.createdBy, userId),
      );
}
