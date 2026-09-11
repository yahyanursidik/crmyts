import { describe, expect, it, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import * as client from '../../server/db/client';
import { createMemorableTicketCode, createReferralCode } from '../../server/domain/events/participantCodes';
import { getTicketNumber, extractTicketCode } from '../../src/lib/participantTicket';
import { toDataURL } from 'qrcode';

describe('Participant ticket portal and memorable participant codes', () => {
  it('creates short, compact numeric ticket and invitation codes', () => {
    expect(createMemorableTicketCode()).toMatch(/^YTS-\d{4,5}$/);
    expect(createReferralCode()).toMatch(/^AJAK-\d{4,5}$/);
    expect(createMemorableTicketCode(1)).toBe('YTS-1001');
    expect(createMemorableTicketCode(48)).toBe('YTS-1048');
  });

  it('normalizes 4-6 digit numeric inputs to YTS prefix and extracts ticket numbers', () => {
    expect(extractTicketCode('1048')).toBe('YTS-1048');
    expect(extractTicketCode('  1001  ')).toBe('YTS-1001');
    expect(extractTicketCode('YTS-1048')).toBe('YTS-1048');
    expect(extractTicketCode('https://example.test/peserta/123?ticket=1048')).toBe('YTS-1048');
    expect(getTicketNumber('YTS-1048')).toBe('1048');
    expect(getTicketNumber('TIKET-KJN-260911-ABCD')).toBe('TIKET-KJN-260911-ABCD');
  });

  it('creates a scannable QR payload and extracts the ticket from a participant portal URL', async () => {
    const portalUrl = 'https://example.test/peserta/018f0000-0000-0000-0000-000000000015?ticket=YTS-1048';
    const dataUrl = await toDataURL(portalUrl, { errorCorrectionLevel: 'M' });
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(extractTicketCode(portalUrl)).toBe('YTS-1048');
    expect(extractTicketCode(' yts-ilmu-nur-482 ')).toBe('YTS-ILMU-NUR-482');
  });

  it('requires the matching WhatsApp number before returning a participant ticket', async () => {
    const router = new Router();
    registerPublicPortalRoutes(router);

    const attendance = {
      id: '018f0000-0000-0000-0000-000000000014',
      eventId: '018f0000-0000-0000-0000-000000000015',
      ticketCode: 'YTS-ILMU-NUR-482',
      referralCode: 'AJAK-SALAM-UMAT-321',
      status: 'registered',
      checkInAt: new Date('2026-09-10T01:00:00.000Z'),
      paymentStatus: 'free',
      person: {
        fullName: 'Abu Fulan',
        phoneE164: '+6281234567890',
        gender: 'ikhwan',
      },
    };
    const event = {
      id: attendance.eventId,
      title: 'Kajian Adab Penuntut Ilmu',
      speaker: 'Ustadz Fulan',
      startAt: new Date('2026-09-12T01:00:00.000Z'),
      deliveryMode: 'offline',
      locationName: 'Masjid YTS',
      formConfig: {
        whatsappGroupIkhwanUrl: 'https://chat.whatsapp.com/ValidGroupToken',
        whatsappGroupAkhwatUrl: 'https://chat.whatsapp.com/OtherGroupToken',
      },
      venueRules: ['silent_phone'],
    };
    const mockDb = {
      query: {
        eventAttendance: { findFirst: vi.fn().mockResolvedValue(attendance) },
        events: { findFirst: vi.fn().mockResolvedValue(event) },
      },
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const response = await router.handle({
      requestId: 'participant_ticket_ok',
      method: 'POST',
      path: '/api/public/participant-ticket',
      headers: {},
      query: {},
      params: {},
      body: {
        eventId: attendance.eventId,
        ticketCode: 'https://example.test/peserta/018f0000-0000-0000-0000-000000000015?ticket=YTS-ILMU-NUR-482',
        phone: '081234567890',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.participant.ticketCode).toBe('YTS-ILMU-NUR-482');
    expect(body.data.event.whatsappGroupInviteUrl).toBe(event.formConfig.whatsappGroupIkhwanUrl);
    expect(body.data.participant.referralLink).toContain('AJAK-SALAM-UMAT-321');

    mockDb.query.eventAttendance.findFirst.mockResolvedValueOnce({
      ...attendance,
      person: { ...attendance.person, phoneE164: '+6281999999999' },
    });
    const rejected = await router.handle({
      requestId: 'participant_ticket_reject',
      method: 'POST',
      path: '/api/public/participant-ticket',
      headers: {},
      query: {},
      params: {},
      body: { eventId: attendance.eventId, ticketCode: attendance.ticketCode, phone: '081234567890' },
    });
    expect(rejected.statusCode).toBe(404);
    expect(JSON.parse(rejected.body).error.message).toBe('Tiket atau nomor WhatsApp tidak sesuai.');
  });
});
