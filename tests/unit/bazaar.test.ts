import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../../server/http/router';
import { registerBazaarRoutes } from '../../server/domain/bazaar/routes';
import * as client from '../../server/db/client';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';

describe('PRD Web App YTS Bazar – Tenant & Event Management System', () => {
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
  const sampleAppId = '018f5555-6666-7000-8000-000000000005';

  const mockDb = {
    execute: vi.fn().mockResolvedValue([]),
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
      bazaarApplications: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      bazaarSurveys: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      bazaarIncidents: {
        findMany: vi.fn(),
      },
      bazaarEvaluations: {
        findFirst: vi.fn(),
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

  it('4. POST /api/public/events/:id/bazaar/apply creates master tenant CRM & application with preference', async () => {
    mockDb.query.bazaarEvents.findFirst.mockResolvedValue({
      id: sampleBazaarId,
      eventId: sampleEventId,
      isOpen: true,
      defaultFeeRupiah: 150000,
    });

    mockDb.query.bazaarTenants.findFirst.mockResolvedValue(null);
    mockDb.query.persons.findFirst.mockResolvedValue(null);

    const mockPerson = { id: 'p1', fullName: 'Abu Fulan' };
    const mockTenant = { id: sampleTenantId, brandName: 'Madu Al-Barkah', picPhone: '+6281234567890' };
    const mockApp = { id: sampleAppId, bazaarId: sampleBazaarId, tenantId: sampleTenantId, status: 'submitted' };

    mockDb.insert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockPerson]) }),
      })
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockTenant]) }),
      })
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockApp]) }),
      });

    mockDb.query.bazaarApplications.findFirst.mockResolvedValue(null);

    const res = await router.handle({
      requestId: 'req_bazaar_4',
      method: 'POST',
      path: `/api/public/events/${sampleEventId}/bazaar/apply`,
      headers: {},
      query: {},
      params: { id: sampleEventId },
      body: {
        brandName: 'Madu Al-Barkah',
        businessCategory: 'herbal_kesehatan',
        picName: 'Abu Fulan',
        picPhone: '081234567890',
        productDescription: 'Madu Murni Hutan Riau',
        electricityNeeded: true,
        electricityWatts: 450,
        boothPreferences: 'Dekat pintu masuk utama',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.application.id).toBe(sampleAppId);
    expect(json.data.tenant.brandName).toBe('Madu Al-Barkah');
  });

  it('5. PUT /api/events/:id/bazaar/applications/:appId/assign-booth assigns booth and returns warning if category collision occurs', async () => {
    mockDb.query.bazaarApplications.findFirst.mockResolvedValue({
      id: sampleAppId,
      bazaarId: sampleBazaarId,
      tenant: { id: sampleTenantId, businessCategory: 'kuliner' },
    });

    mockDb.query.bazaarBooths.findFirst.mockResolvedValue({
      id: sampleBoothId,
      bazaarId: sampleBazaarId,
      code: 'K-02',
      zone: 'Area Kuliner',
    });

    // Mock existing app in the same zone with same category
    mockDb.query.bazaarApplications.findMany.mockResolvedValue([
      {
        id: 'app_other',
        tenant: { businessCategory: 'kuliner' },
        assignedBooth: { code: 'K-01', zone: 'Area Kuliner' },
      },
    ]);

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: sampleAppId, assignedBoothId: sampleBoothId, status: 'booth_assigned' },
          ]),
        }),
      }),
    });

    const res = await router.handle({
      requestId: 'req_bazaar_5',
      method: 'PUT',
      path: `/api/events/${sampleEventId}/bazaar/applications/${sampleAppId}/assign-booth`,
      headers: {},
      query: {},
      params: { id: sampleEventId, appId: sampleAppId },
      body: {
        boothId: sampleBoothId,
        placementReason: 'category_isolation',
      },
      user: mockAdminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.assignedBoothId).toBe(sampleBoothId);
    expect(json.data.smartWarning).toContain("Terdapat 1 booth berkategori 'kuliner' di zona 'Area Kuliner'");
  });

  it('6. POST /api/events/:id/bazaar/check-in checks in tenant on event day', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: sampleAppId, status: 'checked_in' }]),
        }),
      }),
    });

    const res = await router.handle({
      requestId: 'req_bazaar_6',
      method: 'POST',
      path: `/api/events/${sampleEventId}/bazaar/check-in`,
      headers: {},
      query: {},
      params: { id: sampleEventId },
      body: { applicationId: sampleAppId },
      user: mockAdminUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.status).toBe('checked_in');
  });

  it('7. POST /api/public/events/:id/bazaar/survey submits post-event survey with omzet range', async () => {
    mockDb.query.bazaarApplications.findFirst.mockResolvedValue({
      id: sampleAppId,
      tenantId: sampleTenantId,
    });
    mockDb.query.bazaarSurveys.findFirst.mockResolvedValue(null);

    const mockSurvey = {
      id: 'survey_1',
      applicationId: sampleAppId,
      omzetRange: '2-5m',
      satisfactionOverall: 5,
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockSurvey]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const res = await router.handle({
      requestId: 'req_bazaar_7',
      method: 'POST',
      path: `/api/public/events/${sampleEventId}/bazaar/survey`,
      headers: {},
      query: {},
      params: { id: sampleEventId },
      body: {
        applicationId: sampleAppId,
        satisfactionOverall: 5,
        satisfactionLocation: 4,
        satisfactionFacilities: 5,
        satisfactionCommunication: 5,
        satisfactionTraffic: 4,
        omzetRange: '2-5m',
        feedback: 'Alhamdulillah ramai dan tertib.',
        willingToJoinNext: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.omzetRange).toBe('2-5m');
  });
});
