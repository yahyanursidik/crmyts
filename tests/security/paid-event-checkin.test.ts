import { describe, it, expect, vi, afterEach } from 'vitest';
import { Router } from '../../server/http/router';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import * as client from '../../server/db/client';

afterEach(() => vi.restoreAllMocks());
const eventId = '018f0000-0000-7000-8000-000000000001';
const attendanceId = '018f0000-0000-7000-8000-000000000002';
const gateToken = 'unit-test-private-gate-payment-check';
const staff = { id: '018f0000-0000-7000-8000-000000000003', roles: ['event_admin'], isActive: true };

describe.each(['pending_payment', 'waiting_verification', 'rejected'])('Payment gate: %s', (paymentStatus) => {
  it.each([
    { path: `/api/events/${eventId}/attendances/scan`, body: { ticketCode: 'YTS-12345' } },
    { path: `/api/events/${eventId}/toggle-attendance`, body: { attendanceId } },
    { path: `/api/events/${eventId}/attendance`, body: { ticketCode: 'YTS-12345' } },
    { path: `/api/events/${eventId}/attendance`, body: { personId: '018f0000-0000-7000-8000-000000000004' } },
    { path: `/api/public/gate/events/${eventId}/scan`, body: { ticketCode: 'YTS-12345' } },
    { path: `/api/public/gate/events/${eventId}/toggle-checkin`, body: { attendanceId, targetStatus: 'attended' } },
  ])('blocks $path before changing attendance', async ({ path, body }) => {
    const update = vi.fn();
    vi.spyOn(client, 'getDb').mockReturnValue({ query: {
      events: { findFirst: vi.fn().mockResolvedValue({ id: eventId, formConfig: { gateAccessToken: gateToken } }) },
      eventAttendance: { findFirst: vi.fn().mockResolvedValue({ id: attendanceId, eventId, status: 'registered', paymentStatus }) },
    }, update } as any);
    const router = new Router(); registerEventsRoutes(router); registerPublicPortalRoutes(router);
    const response = await router.handle({ requestId: 'payment-check', method: 'POST', path, headers: { 'x-gate-access': gateToken }, query: {}, params: {}, body, user: staff } as any);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('INVALID_STATE_TRANSITION');
    expect(update).not.toHaveBeenCalled();
  });
});
