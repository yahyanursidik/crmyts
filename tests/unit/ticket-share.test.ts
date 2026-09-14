import { describe, it, expect } from 'vitest';
import {
  buildParticipantPortalPath,
  buildWhatsAppShareUrl,
  buildTelegramShareUrl,
  formatTicketShareMessageSingle,
  formatTicketShareMessageGroup,
  extractTicketCode,
} from '../../src/lib/participantTicket';

describe('Participant Ticket Sharing & Multi-Participant QR Utilities', () => {
  const mockEvent = {
    id: 'ev-ramadan-2026',
    title: "Program I'tikaf 10 Malam Terakhir Ramadan 1447H",
    speaker: 'Ustadz Abu Haidar As-Sundawy',
    startAt: '2026-04-05T20:00:00.000Z',
    locationName: 'Masjid Tarbiyah Sunnah Bandung',
  };

  describe('buildWhatsAppShareUrl', () => {
    it('creates direct wa.me URL when phone starts with 08', () => {
      const url = buildWhatsAppShareUrl('Bismillah tiket saya', '081234567890');
      expect(url).toContain('https://wa.me/6281234567890?text=Bismillah%20tiket%20saya');
    });

    it('creates direct wa.me URL when phone starts with +62', () => {
      const url = buildWhatsAppShareUrl('Halo', '+6281234567890');
      expect(url).toContain('https://wa.me/6281234567890?text=Halo');
    });

    it('creates direct wa.me URL when phone starts with 8', () => {
      const url = buildWhatsAppShareUrl('Halo', '81234567890');
      expect(url).toContain('https://wa.me/6281234567890?text=Halo');
    });

    it('creates general share URL when phone is not provided', () => {
      const url = buildWhatsAppShareUrl('Bismillah');
      expect(url).toBe('https://api.whatsapp.com/send?text=Bismillah');
    });

    it('creates general share URL when phone is invalid', () => {
      const url = buildWhatsAppShareUrl('Bismillah', '12345');
      expect(url).toBe('https://api.whatsapp.com/send?text=Bismillah');
    });
  });

  describe('buildTelegramShareUrl', () => {
    it('creates official Telegram share URL with url and text params', () => {
      const targetUrl = 'https://tarbiyahsunnah.id/peserta/ev-1?ticket=YTS-1048';
      const text = 'Ini tiket kajian saya';
      const tgUrl = buildTelegramShareUrl(targetUrl, text);

      expect(tgUrl).toContain('https://t.me/share/url');
      expect(tgUrl).toContain(`url=${encodeURIComponent(targetUrl)}`);
      expect(tgUrl).toContain(`text=${encodeURIComponent(text)}`);
    });
  });

  describe('formatTicketShareMessageSingle', () => {
    it('formats single regular ticket message correctly', () => {
      const portalUrl = 'https://tarbiyahsunnah.id' + buildParticipantPortalPath(mockEvent.id, 'YTS-1048');
      const msg = formatTicketShareMessageSingle({
        eventTitle: mockEvent.title,
        speaker: mockEvent.speaker,
        startAt: mockEvent.startAt,
        locationName: mockEvent.locationName,
        participantName: 'Ahmad bin Fulan',
        relationship: 'Pendaftar Utama',
        gender: 'ikhwan',
        ticketCode: 'YTS-1048',
        portalUrl,
        isSpecialInvite: false,
      });

      expect(msg).toContain('BUKTI PENDAFTARAN MAJELIS ILMU');
      expect(msg).toContain('Ahmad bin Fulan');
      expect(msg).toContain(mockEvent.title);
      expect(msg).toContain(mockEvent.speaker);
      expect(msg).toContain(mockEvent.locationName);
      expect(msg).toContain('YTS-1048');
      expect(msg).toContain(portalUrl);
      expect(msg).not.toContain('Jalur Undangan Khusus');
    });

    it('formats single VIP invite ticket message with special VIP badge', () => {
      const portalUrl = 'https://tarbiyahsunnah.id' + buildParticipantPortalPath(mockEvent.id, 'YTS-VIP-99');
      const msg = formatTicketShareMessageSingle({
        eventTitle: mockEvent.title,
        speaker: mockEvent.speaker,
        startAt: mockEvent.startAt,
        locationName: mockEvent.locationName,
        participantName: 'Ustadz Tamu Terhormat',
        relationship: 'Tamu VIP',
        gender: 'ikhwan',
        ticketCode: 'YTS-VIP-99',
        portalUrl,
        isSpecialInvite: true,
      });

      expect(msg).toContain('✨ *Jalur Undangan Khusus Resmi Panitia (VIP)*');
      expect(msg).toContain('YTS-VIP-99');
      expect(msg).toContain('Ustadz Tamu Terhormat');
    });
  });

  describe('formatTicketShareMessageGroup', () => {
    it('formats multi-participant group tickets with each individual member ticket and QR link', () => {
      const groupTickets = [
        {
          name: 'Abu Ziyad Abdullah',
          relationship: 'Kepala Keluarga / Pendaftar Utama',
          gender: 'ikhwan',
          ticketCode: 'YTS-7701',
          portalUrl: 'https://tarbiyahsunnah.id/peserta/ev-1?ticket=YTS-7701',
        },
        {
          name: 'Ummu Ziyad',
          relationship: 'Istri',
          gender: 'akhwat',
          ticketCode: 'YTS-7702',
          portalUrl: 'https://tarbiyahsunnah.id/peserta/ev-1?ticket=YTS-7702',
        },
        {
          name: 'Ziyad bin Abdullah',
          relationship: 'Anak Laki-laki',
          gender: 'ikhwan',
          ticketCode: 'YTS-7703',
          portalUrl: 'https://tarbiyahsunnah.id/peserta/ev-1?ticket=YTS-7703',
        },
      ];

      const msg = formatTicketShareMessageGroup({
        eventTitle: mockEvent.title,
        speaker: mockEvent.speaker,
        startAt: mockEvent.startAt,
        locationName: mockEvent.locationName,
        registrantName: 'Abu Ziyad Abdullah',
        totalParticipants: 3,
        groupTickets,
        isSpecialInvite: false,
      });

      expect(msg).toContain('BUKTI PENDAFTARAN ROMBONGAN / KELUARGA');
      expect(msg).toContain('Total 3 Peserta');
      expect(msg).toContain('1. *Abu Ziyad Abdullah*');
      expect(msg).toContain('No. Tiket: YTS-7701');
      expect(msg).toContain('Link QR Presensi: https://tarbiyahsunnah.id/peserta/ev-1?ticket=YTS-7701');
      expect(msg).toContain('2. *Ummu Ziyad* (Istri)');
      expect(msg).toContain('No. Tiket: YTS-7702');
      expect(msg).toContain('Link QR Presensi: https://tarbiyahsunnah.id/peserta/ev-1?ticket=YTS-7702');
      expect(msg).toContain('3. *Ziyad bin Abdullah* (Anak Laki-laki)');
      expect(msg).toContain('No. Tiket: YTS-7703');
      expect(msg).toContain('Link QR Presensi: https://tarbiyahsunnah.id/peserta/ev-1?ticket=YTS-7703');
    });
  });

  describe('extractTicketCode compatibility', () => {
    it('extracts ticket code from URL query parameter', () => {
      expect(extractTicketCode('https://domain.com/peserta/123?ticket=YTS-8888')).toBe('YTS-8888');
    });

    it('extracts and prepends YTS prefix from 4-6 digits', () => {
      expect(extractTicketCode('1048')).toBe('YTS-1048');
    });
  });
});
