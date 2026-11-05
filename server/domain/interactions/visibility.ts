import { eq, or, sql } from "drizzle-orm";
import { interactions, tasks } from "../../db/schema";
import {
  hasPermission,
  PERMISSIONS,
  type RoleCode,
} from "../../permissions/constants";

/** Restricted communication is visible to its responsible staff and authorized readers. */
export function interactionVisibility(roles: RoleCode[], userId: string) {
  return hasPermission(roles, PERMISSIONS.SENSITIVE_NOTES_VIEW)
    ? undefined
    : or(
        eq(interactions.sensitivityLevel, "standard"),
        eq(interactions.ownerUserId, userId),
        eq(interactions.createdBy, userId),
      );
}

/** Follow-up tasks inherit the source communication's audience. */
export function linkedInteractionTaskVisibility(
  roles: RoleCode[],
  userId: string,
) {
  if (!hasPermission(roles, PERMISSIONS.INTERACTIONS_VIEW))
    return sql`${tasks.relatedType} IS DISTINCT FROM 'interaction'`;
  const sourceScope = hasPermission(roles, PERMISSIONS.SENSITIVE_NOTES_VIEW)
    ? sql`true`
    : sql`(source_interaction.sensitivity_level='standard' OR source_interaction.owner_user_id=${userId} OR source_interaction.created_by=${userId})`;
  return sql`(${tasks.relatedType} IS DISTINCT FROM 'interaction' OR EXISTS(SELECT 1 FROM interactions source_interaction WHERE source_interaction.id=${tasks.relatedId} AND ${sourceScope}))`;
}
