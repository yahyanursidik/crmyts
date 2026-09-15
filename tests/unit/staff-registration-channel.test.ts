import { describe, expect, it, vi } from 'vitest';
import {
  createStaffRegistrationToken,
  hasValidStaffRegistrationToken,
  isRegularRegistration,
  isSpecialInviteRegistration,
  isStaffRegistration,
  STAFF_REGISTRATION_CHANNEL,
} from '../../server/domain/events/registrationChannels';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import * as client from '../../server/db/client';

describe('staff event registration channel', () => {
  it('keeps staff, regular, and special invite quota classifications independent', () => {
    const staff = { registrationData: { registrationChannel: STAFF_REGISTRATION_CHANNEL }, referredByAttendanceId: null };
    const regular = { registrationData: {}, referredByAttendanceId: null };
    const invite = { registrationData: { isSpecialInvite: true }, referredByAttendanceId: null };

    expect(isStaffRegistration(staff)).toBe(true);
    expect(isRegularRegistration(staff)).toBe(false);
    expect(isSpecialInviteRegistration(staff)).toBe(false);

    expect(isRegularRegistration(regular)).toBe(true);
    expect(isSpecialInviteRegistration(invite)).toBe(true);
    expect(isRegularRegistration(invite)).toBe(false);
  });

  it('generates a strong per-event token and rejects a replaced link token', () => {
    const token = createStaffRegistrationToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hasValidStaffRegistrationToken(token, token)).toBe(true);
    expect(hasValidStaffRegistrationToken(`${token}x`, token)).toBe(false);
    expect(hasValidStaffRegistrationToken(null, token)).toBe(false);
  });

  it('only serves staff event data for its token and never returns the token', async () => {
    const router = new Router();
    registerPublicPortalRoutes(router);
    const eventId = '018f0000-0000-0000-0000-000000000123';
    const staffToken = 'a-very-long-staff-registration-token-12345';
    const mockEvent = {
      id: eventId,
      title: 'Kajian Staff',
      category: 'Kajian',
      speaker: 'Ustadz',
      startAt: new Date(Date.now() + 86_400_000),
      endAt: null,
      deliveryMode: 'offline',
      locationName: 'Masjid',
      locationAddress: null,
      googleMapsUrl: null,
      locationDirections: null,
      showGoogleMaps: true,
      targetAudience: 'umum',
      venueRules: [],
      customVenueRules: null,
      formConfig: {},
      staffRegistrationToken: staffToken,
      isStaffRegistrationOpen: true,
      quotaStaff: 2,
      quotaStaffIkhwan: null,
      quotaStaffAkhwat: null,
      attendances: [
        { registrationData: { registrationChannel: STAFF_REGISTRATION_CHANNEL }, referredByAttendanceId: null, person: { id: 'p1', gender: 'ikhwan' } },
        { registrationData: {}, referredByAttendanceId: null, person: { id: 'p2', gender: 'akhwat' } },
      ],
    };
    vi.spyOn(client, 'getDb').mockReturnValue({ query: { events: { findFirst: vi.fn().mockResolvedValue(mockEvent) } } } as any);

    const valid = await router.handle({ method: 'GET', path: `/api/public/events/${eventId}/staff-registration`, headers: {}, query: { token: staffToken }, params: { id: eventId }, body: null } as any);
    const validJson = JSON.parse(valid.body);
    expect(valid.statusCode).toBe(200);
    expect(validJson.data.quota.used).toBe(1);
    expect(validJson.data.event.staffRegistrationToken).toBeUndefined();

    const invalid = await router.handle({ method: 'GET', path: `/api/public/events/${eventId}/staff-registration`, headers: {}, query: { token: 'wrong-token' }, params: { id: eventId }, body: null } as any);
    expect(invalid.statusCode).toBe(404);
  });
});
