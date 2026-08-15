import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerAutomationRoutes } from '../../server/domain/automation/routes';
import { ROLES, PERMISSIONS } from '../../server/permissions/constants';
import * as client from '../../server/db/client';

describe('Service Automation & Official Message Dispatch (Step 35)', () => {
  const router = new Router();
  registerAutomationRoutes(router);

  const csUser = {
    id: '018f9999-0000-7000-8000-111111111111',
    authSubject: 'sub_automation_officer',
    email: 'cs@tarbiyahsunnah.id',
    fullName: 'Ustadz Amil CS',
    roles: [ROLES.CS_OFFICER, ROLES.CRM_ADMIN],
    permissions: Object.values(PERMISSIONS),
    isActive: true,
  };

  it('1. GET /api/automation/templates returns master automated templates', async () => {
    const res = await router.handle({
      requestId: 'req_auto_tpl',
      method: 'GET',
      path: '/api/automation/templates',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: csUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.length).toBe(5);
    expect(json.data.map((t: any) => t.id)).toContain('event_reminder');
    expect(json.data.map((t: any) => t.id)).toContain('attendance_thanks');
    expect(json.data.map((t: any) => t.id)).toContain('donation_thanks');
    expect(json.data.map((t: any) => t.id)).toContain('waqf_followup');
    expect(json.data.map((t: any) => t.id)).toContain('program_report');
  });

  it('2. POST /api/automation/trigger-event-reminder compiles event details & wa.me link', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f9999-0000-7000-8000-222222222222',
            title: 'Tabligh Akbar: Tazkiyatun Nufus',
            speaker: 'Ustadz Abu Haidar As-Sundawy',
            startAt: new Date('2026-08-25T09:00:00.000Z'),
            deliveryMode: 'offline',
            locationName: 'Masjid Tarbiyah Sunnah, Bandung',
          }),
        },
        persons: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: '018f9999-0000-7000-8000-333333333333',
              fullName: 'Bapak Hendra',
              phoneE164: '+6281234567890',
            },
          ]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_auto_event',
      method: 'POST',
      path: '/api/automation/trigger-event-reminder',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: '018f9999-0000-7000-8000-222222222222',
      },
      user: csUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.totalGenerated).toBe(1);
    expect(json.data.items[0].message).toContain('Tazkiyatun Nufus');
    expect(json.data.items[0].message).toContain('Ustadz Abu Haidar As-Sundawy');
    expect(json.data.items[0].waDirectUrl).toContain('https://wa.me/6281234567890?text=');
  });

  it('3. POST /api/automation/trigger-attendance-thanks compiles gratitude and doa istiqomah', async () => {
    const mockDb = {
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f9999-0000-7000-8000-222222222222',
            title: 'Kajian Kitab Tauhid Sore',
            speaker: 'Ustadz Abu Umar',
          }),
        },
        eventAttendance: {
          findMany: vi.fn().mockResolvedValue([
            {
              person: {
                id: '018f9999-0000-7000-8000-333333333333',
                fullName: 'Akhi Salman',
                phoneE164: '+6281299887766',
              },
            },
          ]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_auto_attend_thanks',
      method: 'POST',
      path: '/api/automation/trigger-attendance-thanks',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: '018f9999-0000-7000-8000-222222222222',
      },
      user: csUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.totalAttendees).toBe(1);
    expect(json.data.items[0].message).toContain('Alhamdulillah, terima kasih banyak atas kehadiran');
    expect(json.data.items[0].message).toContain('Mari kita berdoa semoga Allah Ta\'ala meneguhkan hati kita di atas istiqomah');
    expect(json.data.items[0].message).toContain('memudahkan kita dalam mengamalkan ilmu-ilmu yang telah didapat');
    expect(json.data.items[0].waDirectUrl).toContain('https://wa.me/6281299887766?text=');
  });

  it('4. POST /api/automation/trigger-donation-thanks generates verified donation E-Receipt', async () => {
    const mockDb = {
      query: {
        donations: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f9999-0000-7000-8000-444444444444',
            amountRupiah: '1500000',
            donationDate: new Date('2026-08-14T08:00:00.000Z'),
            person: {
              fullName: 'Ibu Fatimah',
              phoneE164: '+6281311223344',
            },
            program: {
              name: 'Wakaf Pembebasan Lahan Pesantren',
            },
          }),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_auto_thanks',
      method: 'POST',
      path: '/api/automation/trigger-donation-thanks',
      headers: {},
      query: {},
      params: {},
      body: {
        donationId: '018f9999-0000-7000-8000-444444444444',
      },
      user: csUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.donorName).toBe('Ibu Fatimah');
    expect(json.data.amountRupiah).toBe(1500000);
    expect(json.data.message).toContain('Wakaf Pembebasan Lahan Pesantren');
    expect(json.data.message).toContain('Jazakumullahu khairan katsiran');
    expect(json.data.waDirectUrl).toContain('https://wa.me/6281311223344?text=');
  });

  it('5. POST /api/automation/trigger-waqf-followup compiles waqf milestone update', async () => {
    const mockDb = {
      query: {
        waqfCases: {
          findFirst: vi.fn().mockResolvedValue({
            id: '018f9999-0000-7000-8000-555555555555',
            waqfType: 'tanah',
            currentStage: 'document_preparation',
            person: {
              fullName: 'H. Abdullah',
              phoneE164: '+628177889900',
            },
            owner: {
              fullName: 'Akhi Ridwan',
            },
          }),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const res = await router.handle({
      requestId: 'req_auto_waqf',
      method: 'POST',
      path: '/api/automation/trigger-waqf-followup',
      headers: {},
      query: {},
      params: {},
      body: {
        waqfCaseId: '018f9999-0000-7000-8000-555555555555',
        nextStepNotes: 'Berkas telah diserahkan ke Kepala KUA',
      },
      user: csUser,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.waqifName).toBe('H. Abdullah');
    expect(json.data.message).toContain('Berkas telah diserahkan ke Kepala KUA');
    expect(json.data.message).toContain('Pemberkasan Sertifikasi KUA & BPN');
    expect(json.data.waDirectUrl).toContain('https://wa.me/628177889900?text=');
  });
});
