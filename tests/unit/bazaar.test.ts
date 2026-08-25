import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../../server/http/router';
import { registerBazaarRoutes } from '../../server/domain/bazaar/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('Bazaar & Tenant Management Feature', () => {
  const router = new Router();
  registerBazaarRoutes(router);

  const mockAdminUser = {
    id: '018f0000-0000-7000-8000-000000000001',
    authSubject: 'auth_admin_001',
    email: 'kajian@tarbiyahsunnah.id',
    fullName: 'Admin Kajian YTS',
    roles: [ROLES.EVENT_ADMIN],
    permissions: [PERMISSIONS.EVENTS_MANAGE],
    isActive: true,
  };

  const sampleEventId = '018f1111-2222-7000-8000-000000000001';
  const sampleBazaarId = '018f2222-3333-7000-8000-000000000002';
  const sampleBoothId = '018f3333-4444-7000-8000-000000000003';
  const sampleTenantId = '018f4444-5555-7000-8000-000000000004';

  const mockDb = {
    query: {
      events: {
        findFirst: vi.fn(),
      },
      bazaarEvents: {
        findFirst: vi.fn(),
      },
      bazaarBooths: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      bazaarTenants: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      persons: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);
  });

  it('1. GET /api/events/:id/bazaar returns 404 if event does not exist', async () => {
    mockDb.query.events.findFirst.mockResolvedValue(null);

    const res = await router.handle({
      requestId: 'req_bazaar_1',
      method: 'GET',
      path: `/api/events/${sampleEventId}/bazaar`,
      headers: {},
      query: {},
      params: { id: sampleEventId },
      body: {},
      user: mockAdminUser,
    });

    expect(res.statusCode).toBe(404);
  });

  it('2. POST /api/events/:id/bazaar initializes bazaar configuration', async () => {
    mockDb.query.events.findFirst.mockResolvedValue({
      id: sampleEventId,
      title: 'Daurah Kitab Tauhid Syawal 1447H',
    });
    mockDb.query.bazaarEvents.findFirst.mockResolvedValue(null);

    const mockCreated = {
      id: sampleBazaarId,
      eventId: sampleEventId,
      title: 'Bazar Kuliner & Busana Daurah',
      isOpen: true,
      defaultFeeRupiah: 150000,
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockCreated]),
      }),
    });

    const res = await router.handle({
      requestId: 'req_bazaar_2',
      method: 'POST',
      path: `/api/events/${sampleEventId}/bazaar`,
      headers: {},
      query: {},
      params: { id: sampleEventId },
      body: {
        title: 'Bazar Kuliner & Busana Daurah',
        description: 'Bazar resmi jamaah Daurah Syawal 1447H',
        isOpen: true,
        defaultFeeRupiah: 150000,
        bankName: 'BSI',
        bankAccountNumber: '7144778899',
      },
      user: mockAdminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.id).toBe(sampleBazaarId);
    expect(json.data.title).toBe('Bazar Kuliner & Busana Daurah');
  });

  it('3. POST /api/events/:id/bazaar/booths/bulk generates booth slots', async () => {
    mockDb.query.bazaarEvents.findFirst.mockResolvedValue({
      id: sampleBazaarId,
      eventId: sampleEventId,
    });

    const mockBooths = [
      { id: 'b1', code: 'A-01', name: 'Booth Selasar A-01', priceRupiah: 150000 },
      { id: 'b2', code: 'A-02', name: 'Booth Selasar A-02', priceRupiah: 150000 },
    ];

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(mockBooths),
      }),
    });

    const res = await router.handle({
      requestId: 'req_bazaar_3',
      method: 'POST',
      path: `/api/events/${sampleEventId}/bazaar/booths/bulk`,
      headers: {},
      query: {},
      params: { id: sampleEventId },
      body: {
        booths: [
          { code: 'A-01', name: 'Booth Selasar A-01', zone: 'Selasar', priceRupiah: 150000 },
          { code: 'A-02', name: 'Booth Selasar A-02', zone: 'Selasar', priceRupiah: 150000 },
        ],
      },
      user: mockAdminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.length).toBe(2);
    expect(json.data[0].code).toBe('A-01');
  });

  it('4. GET /api/public/events/:id/bazaar returns public sanitized booth layout', async () => {
    mockDb.query.events.findFirst.mockResolvedValue({
      id: sampleEventId,
      title: 'Daurah Kitab Tauhid',
      startAt: new Date().toISOString(),
      speaker: 'Ustadz Fulan',
      locationName: 'Masjid Tarbiyah Sunnah',
    });

    mockDb.query.bazaarEvents.findFirst.mockResolvedValue({
      id: sampleBazaarId,
      title: 'Bazar Daurah Khusus',
      isOpen: true,
      defaultFeeRupiah: 150000,
      booths: [
        { id: sampleBoothId, code: 'A-01', name: 'Booth A-01', zone: 'Selasar', priceRupiah: 150000, status: 'available' },
      ],
    });

    const res = await router.handle({
      requestId: 'req_bazaar_4',
      method: 'GET',
      path: `/api/public/events/${sampleEventId}/bazaar`,
      headers: {},
      query: {},
      params: { id: sampleEventId },
      body: {},
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.bazaar.title).toBe('Bazar Daurah Khusus');
    expect(json.data.bazaar.booths.length).toBe(1);
    expect(json.data.bazaar.booths[0].code).toBe('A-01');
    expect(json.data.bazaar.booths[0].status).toBe('available');
  });

  it('5. POST /api/public/events/:id/bazaar/register registers prospective tenant with slot locking', async () => {
    mockDb.query.bazaarEvents.findFirst.mockResolvedValue({
      id: sampleBazaarId,
      eventId: sampleEventId,
      isOpen: true,
      defaultFeeRupiah: 150000,
    });

    mockDb.query.bazaarBooths.findFirst.mockResolvedValue({
      id: sampleBoothId,
      code: 'A-01',
      name: 'Booth A-01',
      priceRupiah: 150000,
      status: 'available',
    });

    mockDb.query.persons.findFirst.mockResolvedValue({
      id: 'person_01',
      fullName: 'Abu Fulan Herbal',
      phoneE164: '+6281234567890',
    });

    const mockRegisteredTenant = {
      id: sampleTenantId,
      brandName: 'Madu Murni As-Sunnah',
      status: 'pending_review',
      infaqAmountRupiah: 150000,
      registeredAt: new Date().toISOString(),
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockRegisteredTenant]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const res = await router.handle({
      requestId: 'req_bazaar_5',
      method: 'POST',
      path: `/api/public/events/${sampleEventId}/bazaar/register`,
      headers: {},
      query: {},
      params: { id: sampleEventId },
      body: {
        boothId: sampleBoothId,
        brandName: 'Madu Murni As-Sunnah',
        businessCategory: 'herbal_kesehatan',
        picName: 'Abu Fulan',
        picPhone: '081234567890',
        productDescription: 'Madu Habbatus Sauda & Zaitun Murni',
        electricityNeeded: true,
        electricityWatts: 450,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.tenantId).toBe(sampleTenantId);
    expect(json.data.brandName).toBe('Madu Murni As-Sunnah');
    expect(json.data.boothCode).toBe('A-01');
    expect(json.data.status).toBe('pending_review');
  });

  it('6. PUT /api/events/:id/bazaar/tenants/:tenantId/status approves and verifies tenant', async () => {
    mockDb.query.bazaarTenants.findFirst.mockResolvedValue({
      id: sampleTenantId,
      boothId: sampleBoothId,
      status: 'pending_review',
      infaqAmountRupiah: 150000,
    });

    const mockVerifiedTenant = {
      id: sampleTenantId,
      status: 'verified',
      boothId: sampleBoothId,
      infaqAmountRupiah: 150000,
    };

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockVerifiedTenant]),
        }),
      }),
    });

    const res = await router.handle({
      requestId: 'req_bazaar_6',
      method: 'PUT',
      path: `/api/events/${sampleEventId}/bazaar/tenants/${sampleTenantId}/status`,
      headers: {},
      query: {},
      params: { id: sampleEventId, tenantId: sampleTenantId },
      body: {
        status: 'verified',
        boothId: sampleBoothId,
      },
      user: mockAdminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.status).toBe('verified');
  });
});
