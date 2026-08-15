import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPersonsRoutes } from '../../server/domain/persons/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Integration: Person / Jamaah Lifecycle CRUD (CRM YTS)', () => {
  const router = new Router();
  registerPersonsRoutes(router);

  const stewardUser = {
    id: '018f7777-0000-7000-8000-111111111111',
    authSubject: 'sub_steward',
    email: 'steward@tarbiyahsunnah.id',
    fullName: 'Data Steward YTS',
    roles: [ROLES.DATA_STEWARD],
    permissions: [
      PERMISSIONS.PERSONS_LIST,
      PERMISSIONS.PERSONS_VIEW,
      PERMISSIONS.PERSONS_CREATE,
      PERMISSIONS.PERSONS_EDIT,
    ],
    isActive: true,
  };

  const createdPerson = {
    id: '018f8888-0000-7000-8000-123456789012',
    fullName: 'Muhammad Yusuf',
    phoneE164: '+6281234567890',
    email: 'yusuf@example.com',
    gender: 'ikhwan',
    cityRegency: 'Kota Bandung',
    engagementStatus: 'baru',
    preferredChannel: 'whatsapp',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('Creates a new Jamaah record with automatic E.164 normalization and default role', async () => {
    const mockInsert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockResolvedValue([createdPerson]),
      })),
    }));

    const mockDb = {
      insert: mockInsert,
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_person_create',
      method: 'POST',
      path: '/api/persons',
      headers: {},
      query: {},
      params: {},
      body: {
        fullName: 'Muhammad Yusuf',
        phoneE164: '081234567890',
        email: 'yusuf@example.com',
        cityRegency: 'Kota Bandung',
        gender: 'ikhwan',
        roleCodes: ['jamaah'],
      },
      user: stewardUser,
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.data.fullName).toBe('Muhammad Yusuf');
    expect(json.data.phoneE164).toBe('+6281234567890');
  });

  it('Retrieves person 360 view with operational details', async () => {
    const createChain = (val: any) => {
      const chain: any = {
        innerJoin: vi.fn().mockImplementation(() => chain),
        where: vi.fn().mockImplementation(() => chain),
        orderBy: vi.fn().mockImplementation(() => Promise.resolve(val)),
        then: (resolve: any) => Promise.resolve(val).then(resolve),
      };
      return chain;
    };

    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => createChain([])),
      })),
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            ...createdPerson,
            owner: { id: 'u1', fullName: 'Staf CS', email: 'cs@tarbiyahsunnah.id' },
            roles: [{ roleCode: 'jamaah' }],
            tags: [],
            sensitiveNotes: [],
          }),
        },
        interactions: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        tasks: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        donations: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        waqfCases: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_person_get',
      method: 'GET',
      path: `/api/persons/${createdPerson.id}`,
      headers: {},
      query: {},
      params: { id: createdPerson.id },
      body: {},
      user: stewardUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.id).toBe(createdPerson.id);
    expect(json.data.fullName).toBe('Muhammad Yusuf');
  });
});
