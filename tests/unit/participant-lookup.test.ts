import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import * as client from '../../server/db/client';

describe('Public Participant Fast Lookup API (Auto-fill for Returning Jamaah)', () => {
  const router = new Router();
  registerPublicPortalRoutes(router);

  it('POST /api/public/lookup-participant returns person biodata and history when found by WhatsApp phone', async () => {
    const mockPerson = {
      id: '018f0000-0000-0000-0000-000000000099',
      fullName: 'Abu Umar Hendra',
      phoneE164: '+6281234567890',
      email: 'abu.umar@example.com',
      gender: 'ikhwan',
      cityRegency: 'Kota Bandung',
    };

    const mockAttendances = [
      {
        id: 'att_hist_1',
        eventId: 'ev_1',
        personId: mockPerson.id,
        registrationGroupId: 'GRP-20260401-ABC1',
        createdAt: new Date(),
      },
      {
        id: 'att_hist_2',
        eventId: 'ev_2',
        personId: mockPerson.id,
        registrationGroupId: null,
        createdAt: new Date(),
      },
    ];

    const mockFamilyAttendances = [
      {
        id: 'att_fam_1',
        registrationGroupId: 'GRP-20260401-ABC1',
        personId: 'person_wife_1',
        familyRelationship: 'Istri',
        age: 32,
        person: {
          id: 'person_wife_1',
          fullName: 'Ummu Umar',
          gender: 'akhwat',
        },
      },
    ];

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(mockPerson),
        },
        eventAttendance: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce(mockAttendances)
            .mockResolvedValueOnce(mockFamilyAttendances),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/lookup-participant',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        identifier: '081234567890',
      },
      requestId: 'req_lookup_phone_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.found).toBe(true);
    expect(body.data.person.fullName).toBe('Abu Umar Hendra');
    expect(body.data.person.gender).toBe('ikhwan');
    expect(body.data.person.cityRegency).toBe('Kota Bandung');
    expect(body.data.totalKajianAttended).toBe(2);
    expect(body.data.pastFamilyMembers.length).toBe(1);
    expect(body.data.pastFamilyMembers[0].fullName).toBe('Ummu Umar');
    expect(body.data.pastFamilyMembers[0].relationship).toBe('Istri');
  });

  it('POST /api/public/lookup-participant returns person biodata when searched by Email', async () => {
    const mockPerson = {
      id: '018f0000-0000-0000-0000-000000000098',
      fullName: 'Fulanah binti Fulan',
      phoneE164: '+6281398765432',
      email: 'fulanah@gmail.com',
      gender: 'akhwat',
      cityRegency: 'Kota Cimahi',
    };

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(mockPerson),
        },
        eventAttendance: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/lookup-participant',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        identifier: 'fulanah@gmail.com',
      },
      requestId: 'req_lookup_email_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.found).toBe(true);
    expect(body.data.person.fullName).toBe('Fulanah binti Fulan');
    expect(body.data.person.gender).toBe('akhwat');
    expect(body.data.totalKajianAttended).toBe(0);
  });

  it('POST /api/public/lookup-participant returns found: false when identifier does not exist', async () => {
    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/lookup-participant',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        identifier: '089999999999',
      },
      requestId: 'req_lookup_not_found',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.found).toBe(false);
  });
});
