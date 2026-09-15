import { describe, expect, it, vi } from 'vitest';
import {
  createStaffRegistrationToken,
  hasValidStaffRegistrationToken,
  isRegularRegistration,
  isStaffFamilyRegistration,
  isSpecialInviteRegistration,
  isStaffRegistration,
  STAFF_FAMILY_REGISTRATION_CHANNEL,
  STAFF_REGISTRATION_CHANNEL,
} from '../../server/domain/events/registrationChannels';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import * as client from '../../server/db/client';
import { eventAttendance, persons } from '../../server/db/schema';

describe('staff event registration channel', () => {
  it('keeps staff, regular, and special invite quota classifications independent', () => {
    const staff = { registrationData: { registrationChannel: STAFF_REGISTRATION_CHANNEL }, referredByAttendanceId: null };
    const staffFamily = { registrationData: { registrationChannel: STAFF_FAMILY_REGISTRATION_CHANNEL }, referredByAttendanceId: null };
    const regular = { registrationData: {}, referredByAttendanceId: null };
    const invite = { registrationData: { isSpecialInvite: true }, referredByAttendanceId: null };

    expect(isStaffRegistration(staff)).toBe(true);
    expect(isRegularRegistration(staff)).toBe(false);
    expect(isSpecialInviteRegistration(staff)).toBe(false);

    expect(isStaffRegistration(staffFamily)).toBe(true);
    expect(isStaffFamilyRegistration(staffFamily)).toBe(true);
    expect(isRegularRegistration(staffFamily)).toBe(false);
    expect(isSpecialInviteRegistration(staffFamily)).toBe(false);

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

  it('keeps the staff form open for the remaining gender and closes it with a quota reason only when all relevant slots are full', async () => {
    const router = new Router();
    registerPublicPortalRoutes(router);
    const eventId = '018f0000-0000-0000-0000-000000000124';
    const staffToken = 'staff-registration-token-for-segmented-quota-12345';
    const eventWithOnlyIkhwanFull = {
      id: eventId,
      title: 'Kajian Staff Segmentasi',
      category: 'Kajian',
      speaker: 'Ustadz',
      startAt: new Date(Date.now() + 86_400_000),
      targetAudience: 'umum',
      formConfig: {},
      staffRegistrationToken: staffToken,
      isStaffRegistrationOpen: true,
      quotaStaff: null,
      quotaStaffIkhwan: 1,
      quotaStaffAkhwat: 1,
      attendances: [{ registrationData: { registrationChannel: STAFF_REGISTRATION_CHANNEL }, person: { id: 'p1', gender: 'ikhwan' } }],
    };
    vi.spyOn(client, 'getDb').mockReturnValue({ query: { events: { findFirst: vi.fn().mockResolvedValue(eventWithOnlyIkhwanFull) } } } as any);

    const partial = await router.handle({ method: 'GET', path: `/api/public/events/${eventId}/staff-registration`, headers: {}, query: { token: staffToken }, params: { id: eventId }, body: null } as any);
    const partialBody = JSON.parse(partial.body);
    expect(partial.statusCode).toBe(200);
    expect(partialBody.data.event.isRegistrationOpen).toBe(true);
    expect(partialBody.data.event.registrationClosedReason).toBeNull();
    expect(partialBody.data.quota.isIkhwanFull).toBe(true);
    expect(partialBody.data.quota.isAkhwatFull).toBe(false);

    eventWithOnlyIkhwanFull.attendances.push({ registrationData: { registrationChannel: STAFF_REGISTRATION_CHANNEL }, person: { id: 'p2', gender: 'akhwat' } });
    const full = await router.handle({ method: 'GET', path: `/api/public/events/${eventId}/staff-registration`, headers: {}, query: { token: staffToken }, params: { id: eventId }, body: null } as any);
    const fullBody = JSON.parse(full.body);
    expect(full.statusCode).toBe(200);
    expect(fullBody.data.event.isRegistrationOpen).toBe(false);
    expect(fullBody.data.event.registrationClosedReason).toBe('quota_full');
  });

  it('registers a staff member and family with isolated staff quota, labels, and individual tickets', async () => {
    const router = new Router();
    registerPublicPortalRoutes(router);
    const eventId = '018f0000-0000-0000-0000-000000000456';
    const staffToken = 'another-long-staff-registration-token-12345';
    const insertedAttendances: any[] = [];
    const mockEvent = {
      id: eventId,
      title: 'Kajian Keluarga Staff',
      category: 'Kajian',
      speaker: 'Ustadz',
      startAt: new Date(Date.now() + 86_400_000),
      targetAudience: 'umum',
      minAge: null,
      formConfig: { allowStaffFamilyRegistration: true, maxStaffFamilyParticipants: 2 },
      staffRegistrationToken: staffToken,
      isStaffRegistrationOpen: true,
      quotaStaff: 3,
      quotaStaffIkhwan: 2,
      quotaStaffAkhwat: 1,
      attendances: [],
    };
    const mockDb = {
      query: {
        events: { findFirst: vi.fn().mockResolvedValue(mockEvent) },
        persons: { findFirst: vi.fn().mockResolvedValue(null) },
        eventAttendance: { findFirst: vi.fn().mockResolvedValue(null) },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === persons) {
          return {
            values: vi.fn().mockImplementation((values) => ({
              returning: vi.fn().mockResolvedValue([{ ...values, id: `person-${Math.random().toString(36).slice(2)}` }]),
            })),
          };
        }
        if (table === eventAttendance) {
          return {
            values: vi.fn().mockImplementation((values) => {
              insertedAttendances.push(values);
              return Promise.resolve();
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const result = await router.handle({
      method: 'POST',
      path: '/api/public/register-staff-event',
      headers: { 'content-type': 'application/json' },
      query: {},
      params: {},
      requestId: 'req_staff_family_1',
      body: {
        eventId,
        staffToken,
        fullName: 'Ahmad Staff',
        phone: '081234567890',
        gender: 'ikhwan',
        unitName: 'Operasional',
        roleName: 'Koordinator',
        agreedToRules: true,
        additionalParticipants: [
          { fullName: 'Siti Staff', gender: 'akhwat', relationship: 'Pasangan', age: 31 },
          { fullName: 'Zaid Staff', gender: 'ikhwan', relationship: 'Anak', age: 9 },
        ],
      },
    } as any);

    expect(result.statusCode).toBe(201);
    const json = JSON.parse(result.body);
    expect(json.data.isGroupRegistration).toBe(true);
    expect(json.data.totalParticipantsCount).toBe(3);
    expect(json.data.groupTickets).toHaveLength(3);
    expect(insertedAttendances).toHaveLength(3);
    expect(insertedAttendances[0].registrationData.registrationChannel).toBe(STAFF_REGISTRATION_CHANNEL);
    expect(insertedAttendances.slice(1).every((attendance) => attendance.registrationData.registrationChannel === STAFF_FAMILY_REGISTRATION_CHANNEL)).toBe(true);
    expect(insertedAttendances.slice(1).every((attendance) => attendance.familyRelationship)).toBe(true);
    expect(new Set(insertedAttendances.map((attendance) => attendance.registrationGroupId)).size).toBe(1);
  });
});
