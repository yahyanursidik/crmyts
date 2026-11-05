import { afterEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { registerDashboardRoutes } from '../../server/domain/dashboard/routes';
import { Router } from '../../server/http/router';
import * as client from '../../server/db/client';
import { ROLES, type RoleCode } from '../../server/permissions/constants';
import { eventPanelLink, monthlyDonationsLink, openTaskCount } from '../../src/features/dashboard/model';
import type { DashboardResponse } from '../../src/features/dashboard/types';
import { jakartaCalendarWindow } from '../../server/domain/dashboard/time';

afterEach(() => vi.restoreAllMocks());
const user = { id: '018f9999-0000-7000-8000-000000000001', authSubject: 'test', email: 'test@example.test', fullName: 'Pengelola', roles: [ROLES.CRM_ADMIN], permissions: [], isActive: true };
function request(roles: RoleCode[] | null = user.roles) {
  const router = new Router(); registerDashboardRoutes(router);
  return router.handle({ method: 'GET', path: '/api/dashboard/operations', headers: {}, query: {}, params: {}, body: {}, requestId: 'operations-test', ...(roles ? { user: { ...user, roles } } : {}) });
}

describe('Agenda operasional pengelola', () => {
  it.each(Object.values(ROLES).filter((role) => role !== ROLES.CRM_ADMIN))('denies role %s before reading the database', async (role) => {
    const spy = vi.spyOn(client, 'getDb');
    expect((await request([role])).statusCode).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });
  it('requires a staff session', async () => {
    expect((await request(null)).statusCode).toBe(401);
  });
  it('returns bounded agenda and payment queues, with attended separated from registrations', async () => {
    const projection: Array<Record<string, unknown>> = [];
    const predicates: unknown[] = [];
    const limits: number[] = [];
    let index = 0;
    const values = [
      [{ id: 'event-1', title: 'Daurah', registered: 20, attended: 6, quota: 40 }],
      [{ count: 8 }], [{ id: 'event-2', title: 'Kajian', count: 3 }],
    ];
    const db = { select: vi.fn((fields) => {
      projection.push(fields); const rows = values[index++];
      const chain: any = {
        from: () => chain, leftJoin: () => chain, innerJoin: () => chain,
        where: (condition: unknown) => { predicates.push(condition); return chain; },
        groupBy: () => chain, orderBy: () => chain,
        limit: (value: number) => { limits.push(value); return Promise.resolve(rows); },
        then: (resolve: any) => Promise.resolve(rows).then(resolve),
      }; return chain;
    }) };
    vi.spyOn(client, 'getDb').mockReturnValue(db as any);
    const result = await request(); const body = JSON.parse(result.body);
    expect(result.statusCode).toBe(200);
    expect(body.data.upcomingCount).toBe(8);
    expect(body.data.upcomingEvents[0]).toMatchObject({ registered: 20, attended: 6 });
    expect(body.data.paymentReviews[0].count).toBe(3);
    expect(limits).toEqual([4, 5]);
    expect(Object.keys(projection[0]!)).not.toEqual(expect.arrayContaining(['formConfig', 'staffRegistrationToken', 'gateKey']));
    const compiled = predicates.map((predicate: any) => new PgDialect().sqlToQuery(predicate));
    expect(compiled[0]!.params).toContain('scheduled');
    expect(compiled[0]!.params).toContain('ongoing');
    expect(compiled[2]!.params).toContain('waiting_verification');
    expect(body.meta.requestId).toBe('operations-test');
  });
});

describe('Dashboard connections', () => {
  it('uses WIB calendar boundaries across month and year changes', () => {
    const result = jakartaCalendarWindow(new Date('2026-12-31T18:30:00Z'));
    expect(result.monthStart.toISOString()).toBe('2026-12-31T17:00:00.000Z');
    expect(result.monthEnd.toISOString()).toBe('2027-01-31T16:59:59.999Z');
    expect(result.dayStart.toISOString()).toBe('2026-12-31T17:00:00.000Z');
    expect(result.dayEnd.toISOString()).toBe('2027-01-01T16:59:59.999Z');
  });
  it('counts waiting tasks once and excludes completed/cancelled tasks', () => {
    const data = { charts: { taskCompletion: [{ status: 'pending', count: 7 }, { status: 'in_progress', count: 3 }, { status: 'waiting', count: 2 }, { status: 'completed', count: 11 }, { status: 'cancelled', count: 5 }] } } as DashboardResponse;
    expect(openTaskCount(data)).toBe(12);
  });
  it('opens the requested event panel and safely encodes its identifier', () => {
    const url = new URL(eventPanelLink('event & one', 'settings'), 'https://example.test');
    expect(url.pathname).toBe('/events');
    expect(url.searchParams.get('eventId')).toBe('event & one');
    expect(url.searchParams.get('panel')).toBe('settings');
    expect(new URL(eventPanelLink('event-1'), url).searchParams.get('panel')).toBe('participants');
  });
  it('opens verified donations for the WIB reporting month', () => {
    const url = new URL(monthlyDonationsLink(new Date('2026-12-31T18:00:00Z')), 'https://example.test');
    expect(url.searchParams.get('status')).toBe('verified');
    expect(url.searchParams.get('month')).toBe('2027-01');
  });
});
