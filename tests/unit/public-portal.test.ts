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
        formConfig: {
          collectCity: true,
          whatsappGroupIkhwanUrl: 'https://chat.whatsapp.com/IkhwanOnly',
          whatsappGroupAkhwatUrl: 'https://chat.whatsapp.com/AkhwatOnly',
        },
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
    expect(body.data.events[0].formConfig.whatsappGroupIkhwanUrl).toBeUndefined();
    expect(body.data.events[0].formConfig.whatsappGroupAkhwatUrl).toBeUndefined();
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
    expect(body.data.ticketCode).toMatch(/^YTS-\d{4,5}$/);
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

  it('POST /api/public/register-event ignores vehicle input when parking is hidden in Form Builder', async () => {
    let insertedAttendance: any = null;
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000024',
            title: 'Kajian Tanpa Fasilitas Parkir',
            startAt: new Date('2026-08-20T09:00:00Z'),
            targetAudience: 'umum',
            isRegistrationOpen: true,
            formConfig: { collectVehicle: false },
            attendances: [],
          }),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000078',
            fullName: 'Jamaah Tanpa Parkir',
            phoneE164: '+6281211112223',
          }),
        },
        eventAttendance: { findFirst: vi.fn().mockResolvedValue(null) },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            values: vi.fn().mockImplementation((value) => {
              insertedAttendance = value;
              return { returning: vi.fn().mockResolvedValue([{ ...value, id: 'att_no_parking_1' }]) };
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
        eventId: '018f0000-0000-0000-0000-000000000024',
        fullName: 'Jamaah Tanpa Parkir',
        phone: '081211112223',
        gender: 'ikhwan',
        vehicleType: 'car',
        vehiclePlateNumber: 'D 1234 HIDE',
      },
      requestId: 'req_pub_reg_no_parking',
    });

    expect(res.statusCode).toBe(200);
    expect(insertedAttendance.vehicleType).toBe('none');
    expect(insertedAttendance.vehiclePlateNumber).toBeNull();
    const body = JSON.parse(res.body);
    expect(body.data.participant.vehicleType).toBe('none');
    expect(body.data.participant.vehiclePlateNumber).toBeNull();
  });

  it('POST /api/public/register-event ignores hidden biodata and family payloads', async () => {
    let insertedAttendance: any = null;
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000025',
            title: 'Kajian Ringkas',
            startAt: new Date('2026-08-20T09:00:00Z'),
            targetAudience: 'umum',
            isRegistrationOpen: true,
            formConfig: {
              collectEmail: false,
              collectCity: false,
              requireGender: false,
              allowMultiParticipant: false,
            },
            attendances: [],
          }),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000079',
            fullName: 'Jamaah Ringkas',
            phoneE164: '+6281211112224',
          }),
        },
        eventAttendance: { findFirst: vi.fn().mockResolvedValue(null) },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === eventAttendance) {
          return {
            values: vi.fn().mockImplementation((value) => {
              insertedAttendance = value;
              return { returning: vi.fn().mockResolvedValue([{ ...value, id: 'att_hidden_fields_1' }]) };
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
        eventId: '018f0000-0000-0000-0000-000000000025',
        fullName: 'Jamaah Ringkas',
        phone: '081211112224',
        gender: 'akhwat',
        email: 'jamaah@example.com',
        cityRegency: 'Bandung',
        additionalParticipants: [
          { fullName: 'Anggota Yang Tidak Diproses', gender: 'ikhwan', relationship: 'Keluarga' },
        ],
      },
      requestId: 'req_pub_reg_hidden_fields',
    });

    expect(res.statusCode).toBe(200);
    expect(insertedAttendance.registrationGroupId).toBeNull();
    const body = JSON.parse(res.body);
    expect(body.data.participant.gender).toBeNull();
    expect(body.data.isGroupRegistration).toBe(false);
    expect(body.data.totalParticipantsCount).toBe(1);
    expect(body.data.groupTickets).toHaveLength(1);
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
    expect(updatedSetVal.paymentProofUrl).toMatch(/contabostorage\.com|event-proofs/);
    expect(updatedSetVal.paymentAmountRupiah).toBe(75000);
  });

  it('GET /api/public/events/:id/check-invitation validates admin-exclusive invitation code', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ev_123',
            title: 'Kajian Kitab Tauhid',
            formConfig: {
              adminInviteCode: 'UNDANGAN-VIP',
            },
          }),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    // Test with full admin invite code
    const res1 = await router.handle({
      path: '/api/public/events/ev_123/check-invitation',
      method: 'GET',
      headers: {},
      query: { code: 'UNDANGAN-VIP' },
      params: { id: 'ev_123' },
      body: null,
      requestId: 'req_check_inv_1',
    });

    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.body);
    expect(body1.data.valid).toBe(true);
    expect(body1.data.isAdminInvite).toBe(true);
    expect(body1.data.inviteCode).toBe('UNDANGAN-VIP');

    // Test with suffix VIP
    const res2 = await router.handle({
      path: '/api/public/events/ev_123/check-referral',
      method: 'GET',
      headers: {},
      query: { code: 'VIP' },
      params: { id: 'ev_123' },
      body: null,
      requestId: 'req_check_inv_2',
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.data.valid).toBe(true);

    // Test not found / invalid invite code
    const res3 = await router.handle({
      path: '/api/public/events/ev_123/check-invitation',
      method: 'GET',
      headers: {},
      query: { code: 'NOTEXIST' },
      params: { id: 'ev_123' },
      body: null,
      requestId: 'req_check_inv_3',
    });
    expect(res3.statusCode).toBe(404);
  });

  it('POST /api/public/register-event resolves admin invite code and marks attendance as admin_invite', async () => {
    let insertedAttendance: any = null;
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f0000-0000-0000-0000-000000000099',
            title: 'Kajian Akbar Tauhid',
            category: 'Tabligh Akbar',
            speaker: 'Ustadz Fulan',
            startAt: new Date('2026-08-20T09:00:00Z'),
            targetAudience: 'umum',
            isRegistrationOpen: true,
            attendances: [],
            formConfig: {
              adminInviteCode: 'UNDANGAN-018F00',
            },
          }),
        },
        persons: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockImplementation((table) => {
        if (table === persons) {
          return {
            values: vi.fn().mockImplementation((val) => ({
              returning: vi.fn().mockResolvedValue([{ ...val, id: 'person_new_reg_1' }]),
            })),
          };
        }
        if (table === eventAttendance) {
          return {
            values: vi.fn().mockImplementation((val) => {
              insertedAttendance = val;
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
        eventId: '018f0000-0000-0000-0000-000000000099',
        fullName: 'Zaid bin Tsabit',
        phone: '081299998888',
        gender: 'ikhwan',
        inviteCode: 'UNDANGAN-018F00',
      },
      requestId: 'req_invite_reg_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.ticketCode).toMatch(/^YTS-\d{4,5}$/);
    expect(body.data.isSpecialInvite).toBe(true);
    expect(body.data.referralCode).toBeUndefined();
    expect(insertedAttendance).not.toBeNull();
    expect(insertedAttendance.source).toBe('form_registration');
    expect(insertedAttendance.registrationData.inviteSource).toBe('admin_invite');
    expect(insertedAttendance.registrationData.isSpecialInvite).toBe(true);
  });

  it('POST /api/public/participant/my-events retrieves upcoming & history events by WhatsApp number', async () => {
    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'p_jamaah_hub_1',
            fullName: 'Fulan bin Fulan',
            phoneE164: '+6281234567890',
            gender: 'ikhwan',
            cityRegency: 'Kota Bandung',
          }),
        },
        eventAttendance: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'att_upcoming_1',
              ticketCode: 'YTS-1048',
              status: 'registered',
              checkInAt: new Date(),
              paymentStatus: 'free',
              referralCode: 'AJAK-1048',
              event: {
                id: 'ev_future_1',
                title: 'Kajian Akbar Tauhid Akhir Zaman',
                speaker: 'Ustadz Fulan, Lc.',
                category: 'Tabligh Akbar',
                startAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days later
                status: 'scheduled',
                deliveryMode: 'offline',
                locationName: 'Masjid Tarbiyah Sunnah',
                venueRules: ['modest_dress'],
                formConfig: {
                  announcements: [
                    {
                      id: 'ann_1',
                      title: 'Panduan Parkir Mobil',
                      content: 'Gunakan kantong parkir resmi di area barat.',
                      createdAt: new Date().toISOString(),
                    },
                  ],
                },
              },
            },
            {
              id: 'att_past_1',
              ticketCode: 'YTS-0901',
              status: 'attended',
              checkInAt: new Date('2026-07-01T08:00:00Z'),
              paymentStatus: 'free',
              referralCode: 'AJAK-0901',
              event: {
                id: 'ev_past_1',
                title: 'Daurah Ushul Tsalatsah Seri 1',
                speaker: 'Ustadz Fulan, Lc.',
                category: 'Daurah',
                startAt: new Date('2026-07-01T09:00:00Z'),
                status: 'completed',
                deliveryMode: 'offline',
                locationName: 'Masjid Tarbiyah Sunnah',
              },
            },
          ]),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/participant/my-events',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        phone: '081234567890',
      },
      requestId: 'req_hub_my_events_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.person.fullName).toBe('Fulan bin Fulan');
    expect(body.data.upcomingCount).toBe(1);
    expect(body.data.historyCount).toBe(1);
    expect(body.data.upcoming[0].ticketCode).toBe('YTS-1048');
    expect(body.data.history[0].ticketCode).toBe('YTS-0901');
    expect(body.data.history[0].certificateAvailable).toBe(true);
    expect(body.data.announcements.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/public/participant-ticket allows looking up ticket without eventId', async () => {
    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'att_standalone_ticket',
            eventId: 'ev_global_1',
            ticketCode: 'YTS-1048',
            status: 'registered',
            checkInAt: new Date(),
            paymentStatus: 'free',
            person: {
              fullName: 'Ahmad Abdullah',
              gender: 'ikhwan',
              phoneE164: '+6281234567890',
            },
            event: {
              id: 'ev_global_1',
              title: 'Kajian Fiqh Shalat',
              speaker: 'Ustadz Fulan',
              startAt: new Date('2026-10-01T09:00:00Z'),
              deliveryMode: 'offline',
              locationName: 'Masjid Tarbiyah Sunnah',
            },
          }),
        },
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ev_global_1',
            title: 'Kajian Fiqh Shalat',
            speaker: 'Ustadz Fulan',
            startAt: new Date('2026-10-01T09:00:00Z'),
            deliveryMode: 'offline',
            locationName: 'Masjid Tarbiyah Sunnah',
          }),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/participant-ticket',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        ticketCode: '1048', // 4 digits without eventId
        phone: '081234567890',
      },
      requestId: 'req_standalone_ticket_1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.participant.name).toBe('Ahmad Abdullah');
    expect(body.data.event.title).toBe('Kajian Fiqh Shalat');
    expect(body.data.participant.ticketCode).toBe('YTS-1048');
  });

  it('rejects registration when agreedToRules is false', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f1111-0000-7000-8000-111122223333',
            title: 'Kajian Adab Penuntut Ilmu',
            isRegistrationOpen: true,
            formConfig: {
              requireRulesAgreement: true,
              adabRules: ['Niat ikhlas', 'Hadir tepat waktu'],
            },
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
        eventId: '018f1111-0000-7000-8000-111122223333',
        fullName: 'Calon Jamaah',
        phone: '081234567890',
        agreedToRules: false,
      },
      requestId: 'req_reject_rules_test',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('menyetujui Tata Tertib');
  });

  it('delivers adabRules, venueRulesText, and participantRequirements in public portal-info', async () => {
    const mockDb = {
      query: {
        donationPrograms: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        events: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f2222-0000-7000-8000-111122223333',
              title: 'Kajian Rutin Ahad Pagi',
              category: 'Rutin',
              speaker: 'Ustadz Abu Fulan',
              description: 'Deskripsi',
              startAt: new Date('2026-10-01T09:00:00Z'),
              endAt: new Date('2026-10-01T11:00:00Z'),
              deliveryMode: 'offline',
              locationName: 'Masjid Tarbiyah Sunnah',
              status: 'scheduled',
              targetAudience: 'umum',
              quota: 100,
              isRegistrationOpen: true,
              attendances: [],
              formConfig: {
                adabRules: ['Adab 1', 'Adab 2'],
                venueRulesText: 'Aturan khusus lokasi parkir warga',
                participantRequirements: ['Syarat 1', 'Syarat 2'],
                requireRulesAgreement: true,
                whatsappGroupIkhwanUrl: 'https://chat.whatsapp.com/secret-ikhwan',
              },
            },
          ]),
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
      requestId: 'req_portal_rules_delivery',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const eventItem = body.data.events.find((e: any) => e.id === '018f2222-0000-7000-8000-111122223333');
    expect(eventItem).toBeDefined();
    expect(eventItem.formConfig.adabRules).toEqual(['Adab 1', 'Adab 2']);
    expect(eventItem.formConfig.venueRulesText).toBe('Aturan khusus lokasi parkir warga');
    expect(eventItem.formConfig.participantRequirements).toEqual(['Syarat 1', 'Syarat 2']);
    expect(eventItem.formConfig.whatsappGroupIkhwanUrl).toBeUndefined(); // private sanitized
  });

  it('POST /api/public/participant/my-events returns groupMembers for group registrations', async () => {
    const parentPerson = {
      id: '018f3333-0000-7000-8000-111122223333',
      fullName: 'Abu Fulan',
      phoneE164: '+6281234567890',
      gender: 'ikhwan',
    };

    const targetEvent = {
      id: '018f3333-0000-7000-8000-444455556666',
      title: 'Kajian Akbar Rombongan',
      startAt: new Date(Date.now() + 86400000),
      status: 'scheduled',
      formConfig: {},
    };

    const parentAttendance = {
      id: 'att_parent_01',
      eventId: targetEvent.id,
      personId: parentPerson.id,
      ticketCode: 'YTS-ABU-1001',
      registrationGroupId: 'GRP-202610-ABCD',
      familyRelationship: 'Kepala Keluarga / Pendaftar Utama',
      status: 'registered',
      checkInAt: new Date(),
      event: targetEvent,
    };

    const childAttendance = {
      id: 'att_child_02',
      eventId: targetEvent.id,
      personId: '018f3333-0000-7000-8000-777788889999',
      ticketCode: 'YTS-ANAK-1002',
      registrationGroupId: 'GRP-202610-ABCD',
      familyRelationship: 'Anak',
      status: 'registered',
      checkInAt: new Date(),
      person: {
        id: '018f3333-0000-7000-8000-777788889999',
        fullName: 'Fulan Kecil',
        gender: 'ikhwan',
        phoneE164: '+6281234567890-fam-1',
      },
    };

    const mockDb = {
      query: {
        persons: {
          findFirst: vi.fn().mockResolvedValue(parentPerson),
        },
        eventAttendance: {
          findMany: vi.fn().mockImplementation((opts) => {
            if (opts?.where && String(opts?.where).includes('personId')) {
              return Promise.resolve([parentAttendance]);
            }
            return Promise.resolve([
              { ...parentAttendance, person: parentPerson },
              childAttendance,
            ]);
          }),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/participant/my-events',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        phone: '081234567890',
      },
      requestId: 'req_my_events_group',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.upcoming).toHaveLength(1);
    const upcomingTicket = body.data.upcoming[0];
    expect(upcomingTicket.ticketCode).toBe('YTS-ABU-1001');
    expect(upcomingTicket.registrationGroupId).toBe('GRP-202610-ABCD');
    expect(upcomingTicket.groupMembers).toHaveLength(2);
    expect(upcomingTicket.groupMembers[0].name).toBe('Abu Fulan');
    expect(upcomingTicket.groupMembers[0].ticketCode).toBe('YTS-ABU-1001');
    expect(upcomingTicket.groupMembers[1].name).toBe('Fulan Kecil');
    expect(upcomingTicket.groupMembers[1].ticketCode).toBe('YTS-ANAK-1002');
  });

  it('POST /api/public/participant-ticket authorizes family member ticket using parent phone number', async () => {
    const parentPhone = '+6281234567890';
    const childTicketCode = 'YTS-ANAK-1002';
    const groupId = 'GRP-202610-ABCD';

    const childAttendance = {
      id: 'att_child_02',
      eventId: '018f3333-0000-7000-8000-444455556666',
      personId: '018f3333-0000-7000-8000-777788889999',
      ticketCode: childTicketCode,
      registrationGroupId: groupId,
      familyRelationship: 'Anak',
      status: 'registered',
      checkInAt: new Date(),
      person: {
        id: '018f3333-0000-7000-8000-777788889999',
        fullName: 'Fulan Kecil',
        gender: 'ikhwan',
        phoneE164: `${parentPhone}-fam-1`,
      },
      event: {
        id: '018f3333-0000-7000-8000-444455556666',
        title: 'Kajian Akbar Rombongan',
        startAt: new Date(Date.now() + 86400000),
        status: 'scheduled',
        formConfig: {},
      },
    };

    const mockDb = {
      query: {
        eventAttendance: {
          findFirst: vi.fn().mockResolvedValue(childAttendance),
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'att_parent_01',
              ticketCode: 'YTS-ABU-1001',
              familyRelationship: 'Kepala Keluarga',
              person: { fullName: 'Abu Fulan', gender: 'ikhwan' },
            },
            childAttendance,
          ]),
        },
      },
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      path: '/api/public/participant-ticket',
      method: 'POST',
      headers: {},
      query: {},
      params: {},
      body: {
        ticketCode: childTicketCode,
        phone: '081234567890',
      },
      requestId: 'req_child_ticket_check',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.participant.name).toBe('Fulan Kecil');
    expect(body.data.participant.ticketCode).toBe(childTicketCode);
    expect(body.data.participant.familyRelationship).toBe('Anak');
    expect(body.data.participant.groupMembers).toHaveLength(2);
  });
});
