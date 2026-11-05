import { and, asc, count, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { events, eventAttendance } from '../../db/schema';
import { requireAuth } from '../../http/middleware';
import { errorResponse, successResponse } from '../../http/response';
import { Router } from '../../http/router';
import { ROLES } from '../../permissions/constants';

/** Small, read-only agenda projection. Never returns form configuration or gate keys. */
export function registerDashboardOperations(router: Router) {
  router.get('/api/dashboard/operations', requireAuth(async (ctx) => {
    if (!ctx.user!.roles.includes(ROLES.CRM_ADMIN)) {
      return errorResponse('FORBIDDEN', 'Agenda pengelola terbatas untuk administrator.', 403, ctx.requestId);
    }
    const db = getDb();
    const now = new Date();
    const upcoming = or(
      and(eq(events.status, 'scheduled'), gte(events.startAt, now)),
      and(eq(events.status, 'ongoing'), or(isNull(events.endAt), gte(events.endAt, now))),
    );
    const [agenda, [total], paymentReviews] = await Promise.all([
      db.select({
        id: events.id, title: events.title, startAt: events.startAt,
        endAt: events.endAt, speaker: events.speaker, locationName: events.locationName,
        deliveryMode: events.deliveryMode, status: events.status, quota: events.quota,
        isRegistrationOpen: events.isRegistrationOpen,
        registered: sql<number>`count(${eventAttendance.id}) filter (where ${eventAttendance.status} in ('registered', 'attended'))::int`,
        attended: sql<number>`count(${eventAttendance.id}) filter (where ${eventAttendance.status} = 'attended')::int`,
      }).from(events)
        .leftJoin(eventAttendance, eq(eventAttendance.eventId, events.id))
        .where(upcoming).groupBy(events.id).orderBy(asc(events.startAt)).limit(4),
      db.select({ count: count() }).from(events).where(upcoming),
      db.select({
        id: events.id, title: events.title,
        count: sql<number>`count(${eventAttendance.id})::int`,
      }).from(events).innerJoin(eventAttendance, eq(eventAttendance.eventId, events.id))
        .where(and(
          eq(eventAttendance.paymentStatus, 'waiting_verification'),
          inArray(eventAttendance.status, ['registered', 'attended']),
        )).groupBy(events.id).orderBy(asc(events.startAt)).limit(5),
    ]);
    return successResponse({
      generatedAt: now.toISOString(), upcomingCount: total?.count || 0,
      upcomingEvents: agenda, paymentReviews,
    }, { requestId: ctx.requestId });
  }));
}
