import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import * as client from '../../server/db/client';
import { persons, donations, waqfCases, tasks, waqfChecklistItems, eventAttendance } from '../../server/db/schema';

describe('Public Portal & Landing Page API (Infaq, Waqf & Kajian Registration)', () => {
  const router = new Router();
  registerPublicPortalRoutes(router);

  it('GET /api/public/portal-info returns safe public metrics, active programs, BSI bank accounts, and upcoming events', async () => {
    const mockPrograms = [
      {
        id: '018f0000-0000-0000-0000-000000000010',
        name: 'Infaq Operasional Dakwah Sunnah',
        code: 'DAKWAH-01',
        isActive: true,
        createdAt: new Date(),
      },
    ];

    const mockEvents = [
      {
        id: '018f0000-0000-0000-0000-000000000020',
        title: 'Kajian Kitab Tauhid: Pemurnian Ibadah',
        category: 'Kajian Rutin',
        speaker: 'Ustadz Fulan, Lc.',
        startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 3600 * 1000),
        deliveryMode: 'offline',
        locationName: 'Masjid Tarbiyah Sunnah',
        status: 'scheduled',
      },
    ];

    const mockDb = {
      query: {
        donationPrograms: {
          findMany: vi.fn().mockResolvedValue(mockPrograms),
        },
        events: {
          findMany: vi.fn().mockResolvedValue(mockEvents),
        },
        waqfCases: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue([{ totalRupiah: '150000000', count: 120 }]),
        })),
      })),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/portal-info',
      method: 'GET',
      headers: {},
      query: {},
      params: {},
      body: null,
      requestId: 'req_pub_info_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.foundation.name).toBe('Yayasan Tarbiyah Sunnah');
    expect(body.data.programs.length).toBe(1);
    expect(body.data.events.length).toBe(1);
    expect(body.data.events[0].title).toBe('Kajian Kitab Tauhid: Pemurnian Ibadah');
    expect(body.data.bankAccounts.length).toBe(2);
    expect(body.data.bankAccounts[0].accountNumber).toBe('7123456789');
  });

  it('POST /api/public/submit-donation creates unverified donation and follow-up task for amil', async () => {
    let insertedPerson: any = null;
    let insertedDonation: any = null;
    let insertedTask: any = null;

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(null), // New donor
        },
        appUsers: {
          findFirst: vi.fn().mockResolvedValue({ id: '018f0000-0000-7000-8000-000000000001' }),
        },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === persons) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedPerson = { ...val, id: '018f0000-0000-0000-0000-000000000099' };
              return { returning: vi.fn().mockResolvedValue([insertedPerson]) };
            }),
          };
        }
        if (table === donations) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedDonation = { ...val, id: '018f0000-0000-0000-0000-000000000088' };
              return { returning: vi.fn().mockResolvedValue([insertedDonation]) };
            }),
          };
        }
        if (table === tasks) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedTask = { ...val, id: 'tsk_verify_1' };
              return { returning: vi.fn().mockResolvedValue([insertedTask]) };
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/submit-donation',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        fullName: 'Muhsinin Baru',
        phone: '081234567890',
        email: 'muhsinin@example.com',
        programId: '018f0000-0000-0000-0000-000000000010',
        amountRupiah: 500000,
        paymentMethod: 'bank_transfer',
        notes: 'Semoga berkah untuk dakwah sunnah',
        isAnonymous: false,
      },
      requestId: 'req_pub_don_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('unverified');
    expect(body.data.referenceCode).toContain('YTS-');
    expect(insertedPerson).not.toBeNull();
    expect(insertedPerson.phoneE164).toBe('+6281234567890');
    expect(insertedDonation).not.toBeNull();
    expect(insertedDonation.verificationStatus).toBe('unverified');
    expect(insertedTask).not.toBeNull();
    expect(insertedTask.title).toContain('Verifikasi Mutasi Infaq');
  });

  it('POST /api/public/submit-waqf-inquiry creates waqf case in interested stage and checklists', async () => {
    let insertedWaqfCase: any = null;
    let insertedChecklist: any[] = [];
    let insertedTask: any = null;

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000001',
            fullName: 'Bapak Wakif',
            phoneE164: '+6281112223334',
          }),
        },
        appUsers: {
          findFirst: vi.fn().mockResolvedValue({ id: '018f0000-0000-7000-8000-000000000001' }),
        },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === waqfCases) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedWaqfCase = { ...val, id: '018f0000-0000-0000-0000-000000000077' };
              return { returning: vi.fn().mockResolvedValue([insertedWaqfCase]) };
            }),
          };
        }
        if (table === waqfChecklistItems) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedChecklist = val;
              return Promise.resolve();
            }),
          };
        }
        if (table === tasks) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedTask = { ...val, id: 'tsk_waqf_inq_1' };
              return { returning: vi.fn().mockResolvedValue([insertedTask]) };
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/submit-waqf-inquiry',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        fullName: 'Bapak Wakif',
        phone: '081112223334',
        cityRegency: 'Kota Bandung',
        waqfType: 'tanah',
        estimatedValueRupiah: 1500000000,
        locationAddress: 'Jl. Raya Lembang No. 45',
        notesSummary: 'Niat wakaf tanah seluas 1.000 m2 untuk perluasan pesantren.',
      },
      requestId: 'req_pub_wq_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('interested');
    expect(insertedWaqfCase).not.toBeNull();
    expect(insertedWaqfCase.currentStage).toBe('interested');
    expect(insertedChecklist.length).toBe(2);
    expect(insertedTask).not.toBeNull();
    expect(insertedTask.priority).toBe('urgent');
  });

  it('POST /api/public/register-event creates person and registers event attendance with ticket code', async () => {
    let insertedAttendance: any = null;

    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000020',
            title: 'Daurah Fiqh Muamalah Kontemporer',
            category: 'Daurah Khusus',
            speaker: 'Ustadz Dr. Fulan, M.A.',
            startAt: new Date('2026-08-20T09:00:00Z'),
            deliveryMode: 'offline',
            locationName: 'Masjid Tarbiyah Sunnah',
            meetingUrl: null,
          }),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue(null), // New jamaah registrant
        },
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === persons) {
          return {
            values: vi.fn().mockImplementation((val) => ({
              returning: vi.fn().mockResolvedValue([{ ...val, id: '018f0000-0000-0000-0000-000000000030' }]),
            })),
          };
        }
        if (table === eventAttendance) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedAttendance = { ...val, id: 'att_reg_1' };
              return Promise.resolve();
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/register-event',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: '018f0000-0000-0000-0000-000000000020',
        fullName: 'Abdullah Santri',
        phone: '081298765432',
        gender: 'ikhwan',
        email: 'abdullah@example.com',
        cityRegency: 'Kota Bandung',
        notes: 'Semoga bisa mendapatkan kitab panduan cetak',
      },
      requestId: 'req_pub_reg_ev_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.ticketCode).toContain('TIKET-KJN-');
    expect(body.data.event.title).toBe('Daurah Fiqh Muamalah Kontemporer');
    expect(body.data.participant.name).toBe('Abdullah Santri');
    expect(body.data.participant.gender).toBe('ikhwan');
    expect(insertedAttendance).not.toBeNull();
    expect(insertedAttendance.status).toBe('registered');
  });

  it('POST /api/public/register-event rejects registration if gender does not match targetAudience', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000021',
            title: 'Kajian Fiqh Wanita & Thaharah',
            category: 'Kajian Rutin',
            speaker: 'Ustadzah Ummu Fulan',
            startAt: new Date('2026-08-20T09:00:00Z'),
            targetAudience: 'akhwat_only',
            deliveryMode: 'offline',
            isRegistrationOpen: true,
            attendances: [],
          }),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/register-event',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: '018f0000-0000-0000-0000-000000000021',
        fullName: 'Fulan (Laki-laki)',
        phone: '081298765432',
        gender: 'ikhwan',
      },
      requestId: 'req_pub_reg_mismatch',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('kajian ini dikhususkan hanya untuk Jamaah Akhwat');
  });

  it('POST /api/public/register-event rejects registration if parking car quota is full', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000022',
            title: 'Tabligh Akbar Ramadan',
            category: 'Tematik',
            speaker: 'Ustadz Fulan',
            startAt: new Date('2026-08-20T09:00:00Z'),
            targetAudience: 'umum',
            carParkingQuota: 1,
            isRegistrationOpen: true,
            attendances: [
              {
                id: 'att_car_1',
                vehicleType: 'car',
                person: { id: 'p_1', gender: 'ikhwan' },
              },
            ],
          }),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/register-event',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: '018f0000-0000-0000-0000-000000000022',
        fullName: 'Ahmad Mobil',
        phone: '081298765432',
        gender: 'ikhwan',
        vehicleType: 'car',
        vehiclePlateNumber: 'D 9999 XX',
      },
      requestId: 'req_pub_reg_car_full',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('slot fasilitas parkir mobil telah penuh');
  });

  it('POST /api/public/register-event preserves custom dynamic responses and speaker notes in registrationData', async () => {
    let insertedAttendance: any = null;
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000023',
            title: 'Daurah Ushul Tsalatsah',
            category: 'Daurah',
            speaker: 'Ustadz Fulan, Lc.',
            startAt: new Date('2026-08-20T09:00:00Z'),
            targetAudience: 'umum',
            isRegistrationOpen: true,
            attendances: [],
          }),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000077',
            fullName: 'Thalibul Ilmi',
            phoneE164: '+6281211112222',
          }),
        },
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedAttendance = val;
              return {
                returning: vi.fn().mockResolvedValue([{ ...val, id: 'att_custom_1' }]),
              };
            }),
          };
        }
        return { values: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/register-event',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: '018f0000-0000-0000-0000-000000000023',
        fullName: 'Thalibul Ilmi',
        phone: '081211112222',
        gender: 'ikhwan',
        notes: 'Pertanyaan: Apa kitab syarah terbaik untuk pemula?',
        customResponses: {
          ukuran_kitab: 'Hardcover Besar',
          kesiapan_menginap: 'Ya, Menginap Penuh',
        },
      },
      requestId: 'req_custom_fields_1',
    });

    expect(res.statusCode).toBe(200);
    expect(insertedAttendance).not.toBeNull();
    expect(insertedAttendance.registrationData).toEqual({
      ukuran_kitab: 'Hardcover Besar',
      kesiapan_menginap: 'Ya, Menginap Penuh',
      _generalNotes: 'Pertanyaan: Apa kitab syarah terbaik untuk pemula?',
    });
  });

  it('POST /api/public/register-event allows re-uploading payment proof on existing pending registration', async () => {
    let updatedSetVal: any = null;
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000024',
            title: 'Daurah Berbayar',
            category: 'Daurah',
            speaker: 'Ustadz Fulan',
            startAt: new Date('2026-08-20T09:00:00Z'),
            targetAudience: 'umum',
            isPaid: true,
            priceRupiah: 75000,
            isRegistrationOpen: true,
            attendances: [],
          }),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000078',
            fullName: 'Fulan Pembayar',
            phoneE164: '+6281233334444',
          }),
        },
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'att_existing_paid_1',
            eventId: '018f0000-0000-0000-0000-000000000024',
            personId: '018f0000-0000-0000-0000-000000000078',
            ticketCode: 'TIKET-KJN-260820-EX11',
            paymentStatus: 'pending_payment',
            paymentProofUrl: null,
          }),
        },
      },
      update: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            set: vi.fn().mockImplementation((val) => {
              updatedSetVal = val;
              return {
                where: vi.fn().mockResolvedValue([]),
              };
            }),
          };
        }
        return { set: vi.fn().mockResolvedValue([]) };
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/register-event',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: '018f0000-0000-0000-0000-000000000024',
        fullName: 'Fulan Pembayar',
        phone: '081233334444',
        gender: 'ikhwan',
        paymentProofUrl: 'data:image/jpeg;base64,receipt_reupload_data',
      },
      requestId: 'req_reupload_receipt_1',
    });

    expect(res.statusCode).toBe(200);
    expect(updatedSetVal).not.toBeNull();
    expect(updatedSetVal.paymentStatus).toBe('waiting_verification');
    expect(updatedSetVal.paymentProofUrl).toBe('data:image/jpeg;base64,receipt_reupload_data');
    expect(updatedSetVal.paymentAmountRupiah).toBe(75000);
  });
});

