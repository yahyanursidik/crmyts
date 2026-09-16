import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderEmailLayout,
  sendEmail,
  sendEventRegistrationTicketEmail,
  sendEventReminderEmail,
  sendEventAnnouncementEmail,
  sendDonationReceivedEmail,
  sendDonationVerifiedReceiptEmail,
  sendWaqfInquiryConfirmationEmail,
  sendStaffWelcomeEmail,
  sendTestEmail,
  verifyMailketingConnection,
} from '../../server/email/service';
import { getServerEnv, resetServerEnvCache } from '../../server/config/env';

describe('Official Email Service (Mailketing)', () => {
  beforeEach(() => {
    vi.stubEnv('MAILKETING_API_TOKEN', 'test-mailketing-token');
    vi.stubEnv('MAILKETING_WEBHOOK_SECRET', 'test-webhook-secret-1234');
    resetServerEnvCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetServerEnvCache();
  });

  function mockMailketingSuccess(messageId = 'mailketing-message-id') {
    return vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      success: true,
      data: { message_id: messageId, credits: 123 },
    }), { status: 200 }));
  }

  it('loads Mailketing defaults and the approved sender address', () => {
    const env = getServerEnv();
    expect(env.MAILKETING_API_ENDPOINT).toBe('https://api.mailketing.co.id/api/v2/send');
    expect(env.MAILKETING_FROM_NAME).toBe('Yayasan Tarbiyah Sunnah');
    expect(env.MAILKETING_FROM_EMAIL).toBe('no-reply@yts.web.id');
  });

  it('renders official Islamic email layout with brand headers and footers', () => {
    const html = renderEmailLayout('Judul Pengujian', '<p>Isi Pesan Uji</p>');
    expect(html).toContain('Yayasan Tarbiyah Sunnah');
    expect(html).toContain('Bersama Sunnah, Menebar Manfaat');
    expect(html).toContain('no-reply@yts.web.id');
    expect(html).toContain('Isi Pesan Uji');
    expect(html).toContain('Jl. Jurang No.64, Pasteur');
  });

  it('sends the documented Mailketing payload and preserves the message id', async () => {
    const fetchMock = mockMailketingSuccess('provider-message-id');
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendEmail({
      to: 'jamaah@example.com',
      subject: 'Konfirmasi Kajian',
      html: '<p>Assalamu’alaikum</p>',
    });

    expect(result).toEqual({ success: true, messageId: 'provider-message-id' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.mailketing.co.id/api/v2/send');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('X-Api-Token')).toBe('test-mailketing-token');
    expect(JSON.parse(String(init.body))).toMatchObject({
      from_name: 'Yayasan Tarbiyah Sunnah',
      from_email: 'no-reply@yts.web.id',
      recipient: 'jamaah@example.com',
      subject: 'Konfirmasi Kajian',
      content: '<p>Assalamu’alaikum</p>',
    });
  });

  it('preserves a queue-assigned message id so retries stay traceable', async () => {
    const fetchMock = mockMailketingSuccess('queue-message-id');
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendEmail({
      to: 'jamaah@example.com',
      subject: 'Koreksi Waktu Kajian',
      html: '<p>Waktu terbaru</p>',
      messageId: 'yts-campaign-recipient-001',
    })).resolves.toMatchObject({ success: true });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ message_id: 'yts-campaign-recipient-001' });
  });

  it('checks Mailketing credits without sending an email', async () => {
    const fetchMock = mockMailketingSuccess();
    vi.stubGlobal('fetch', fetchMock);

    const health = await verifyMailketingConnection();

    expect(health.success).toBe(true);
    expect(health.credits).toBe(123);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.mailketing.co.id/api/v2/credits');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
  });

  it('uses Mailketing for every official email template', async () => {
    const fetchMock = mockMailketingSuccess();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendEventRegistrationTicketEmail({
      recipientEmail: 'jamaah@example.com', recipientName: 'Fulan bin Fulan', eventTitle: 'Kajian Kitab Tauhid',
      speaker: 'Ustadz Abu Fulan Hafizhahullah', startAtFormatted: 'Ahad, 25 Agustus 2026 09:00 WIB',
      locationName: 'Masjid Tarbiyah Sunnah', ticketCode: 'TIKET-KJN-260825-ABCD', gender: 'ikhwan', eventUrl: 'https://yts.web.id/kajian/123',
    })).resolves.toMatchObject({ success: true });
    await expect(sendEventReminderEmail({
      recipientEmail: 'jamaah@example.com', recipientName: 'Fulan bin Fulan', eventTitle: 'Kajian Kitab Tauhid',
      speaker: 'Ustadz Abu Fulan Hafizhahullah', startAtFormatted: 'Ahad, 25 Agustus 2026 pukul 09.00 WIB',
      locationName: 'Masjid Tarbiyah Sunnah', ticketCode: 'TIKET-KJN-260825-ABCD', eventUrl: 'https://yts.web.id/peserta/123',
    })).resolves.toMatchObject({ success: true });
    await expect(sendEventAnnouncementEmail({
      recipientEmail: 'jamaah@example.com', recipientName: 'Fulan bin Fulan', subject: 'Perubahan Jadwal Kajian',
      message: 'Waktu kajian telah diperbarui.', eventTitle: 'Kajian Kitab Tauhid', speaker: 'Ustadz Abu Fulan Hafizhahullah',
      startAtFormatted: 'Ahad, 25 Agustus 2026 pukul 09.00 WIB', locationName: 'Masjid Tarbiyah Sunnah', ticketCode: 'TIKET-KJN-260825-ABCD',
    })).resolves.toMatchObject({ success: true });
    await expect(sendDonationReceivedEmail({
      recipientEmail: 'donatur@example.com', donorName: 'Abdullah', programName: 'Infaq Dakwah Sunnah',
      amountRupiah: 250000, donationCode: 'YTS-260825-XYZ1', paymentMethod: 'bank_transfer',
    })).resolves.toMatchObject({ success: true });
    await expect(sendDonationVerifiedReceiptEmail({
      recipientEmail: 'donatur@example.com', donorName: 'Abdullah', programName: 'Infaq Dakwah Sunnah',
      amountRupiah: 500000, receiptNumber: 'KWT-YTS-2026-ABCDEF12', verifiedAtFormatted: '25 Agustus 2026 10:00 WIB',
    })).resolves.toMatchObject({ success: true });
    await expect(sendWaqfInquiryConfirmationEmail({
      recipientEmail: 'wakif@example.com', wakifName: 'Ahmad Subarkah', waqfType: 'tanah', inquiryCode: 'WQF-260825-WXYZ',
    })).resolves.toMatchObject({ success: true });
    await expect(sendStaffWelcomeEmail({
      recipientEmail: 'staf@tarbiyahsunnah.id', fullName: 'Ahmad Fauzi', assignedRoles: ['Admin Kajian'], loginUrl: 'https://yts.web.id/login',
    })).resolves.toMatchObject({ success: true });
    await expect(sendTestEmail('admin@tarbiyahsunnah.id')).resolves.toMatchObject({ success: true });

    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});
