import { type Handler, requirePermission } from '../../http/middleware';
import { PERMISSIONS } from '../../permissions/constants';

/** Staff event and bazaar endpoints share the same operational access rules. */
export function requireEventAccess(handler: Handler): Handler {
  return async (ctx) => {
    const permission = ctx.method === 'GET'
      ? PERMISSIONS.EVENTS_VIEW
      : /\/(?:attendance|attendances|toggle-attendance|participants|import-participants|check-in)(?:\/|$)/.test(ctx.path)
        ? PERMISSIONS.ATTENDANCE_MANAGE
        : PERMISSIONS.EVENTS_MANAGE;
    return requirePermission(permission, handler)(ctx);
  };
}
