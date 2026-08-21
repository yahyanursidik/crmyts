import { describe, it, expect, vi } from 'vitest';
import {
  renderEmailLayout,
  getTransporter,
  sendEventRegistrationTicketEmail,
  sendDonationReceivedEmail,
  sendDonationVerifiedReceiptEmail,
  sendWaqfInquiryConfirmationEmail,
  sendStaffWelcomeEmail,
  sendTestEmail,
} from '../../server/email/service';
import { getServerEnv } from '../../server/config/env';

describe('Official Email Service (Kerjamail SMTP)', () => {
  it('loads correct SMTP environment defaults', () => {
    const env = getServerEnv();
    expect(env.SMTP_HOST).toBe('mx.kerjamail.co');
    expect(env.SMTP_PORT).toBe(465);
    expect(env.SMTP_USER).toBe('no-reply@yts.web.id');
    expect(env.SMTP_PASS).toBe('ahlan1447H');
  });

  it('renders official Islamic email layout with brand headers and footers', () => {
    const html = renderEmailLayout('Judul Pengujian', '<p>Isi Pesan Uji</p>');
    expect(html).toContain('Yayasan Tarbiyah Sunnah');
    expect(html).toContain('no-reply@yts.web.id');
    expect(html).toContain('Isi Pesan Uji');
    expect(html).toContain('Jl. Radio No. 1, Cililin');
  });

  it('renders event registration ticket email template correctly', async () => {
    const spy = vi.spyOn(getTransporter(), 'sendMail').mockResolvedValueOnce({
      messageId: 'test-event-msg-id',
    } as any);

    const res = await sendEventRegistrationTicketEmail({
      recipientEmail: 'jamaah@example.com',
      recipientName: 'Fulan bin Fulan',
      eventTitle: 'Kajian Kitab Tauhid',
      speaker: 'Ustadz Abu Fulan Hafizhahullah',
      startAtFormatted: 'Ahad, 25 Agustus 2026 09:00 WIB',
      locationName: 'Masjid Tarbiyah Sunnah',
      ticketCode: 'TIKET-KJN-260825-ABCD',
      gender: 'ikhwan',
      eventUrl: 'https://yts.web.id/kajian/123',
    });

    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const callArg = (spy.mock.calls[0] as any)[0] as any;
    expect(callArg.to).toBe('jamaah@example.com');
    expect(callArg.subject).toContain('Konfirmasi Pendaftaran: Kajian Kitab Tauhid');
    expect(callArg.html).toContain('TIKET-KJN-260825-ABCD');
    expect(callArg.html).toContain('Ustadz Abu Fulan');

    spy.mockRestore();
  });

  it('renders donation received email template with bank details', async () => {
    const spy = vi.spyOn(getTransporter(), 'sendMail').mockResolvedValueOnce({
      messageId: 'test-don-msg-id',
    } as any);

    const res = await sendDonationReceivedEmail({
      recipientEmail: 'donatur@example.com',
      donorName: 'Abdullah',
      programName: 'Infaq Dakwah Sunnah',
      amountRupiah: 250000,
      donationCode: 'YTS-260825-XYZ1',
      paymentMethod: 'bank_transfer',
      bankName: 'Bank Syariah Indonesia (BSI)',
      accountNumber: '7123456789',
      accountHolder: 'Yayasan Tarbiyah Sunnah',
    });

    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const callArg = (spy.mock.calls[0] as any)[0] as any;
    expect(callArg.to).toBe('donatur@example.com');
    expect(callArg.subject).toContain('250.000');
    expect(callArg.html).toContain('7123456789');
    expect(callArg.html).toContain('YTS-260825-XYZ1');

    spy.mockRestore();
  });

  it('renders verified donation receipt email template', async () => {
    const spy = vi.spyOn(getTransporter(), 'sendMail').mockResolvedValueOnce({
      messageId: 'test-receipt-msg-id',
    } as any);

    const res = await sendDonationVerifiedReceiptEmail({
      recipientEmail: 'donatur@example.com',
      donorName: 'Abdullah',
      programName: 'Infaq Dakwah Sunnah',
      amountRupiah: 500000,
      receiptNumber: 'KWT-YTS-2026-ABCDEF12',
      verifiedAtFormatted: '25 Agustus 2026 10:00 WIB',
    });

    expect(res.success).toBe(true);
    const callArg = (spy.mock.calls[0] as any)[0] as any;
    expect(callArg.subject).toContain('Tanda Terima Infaq');
    expect(callArg.html).toContain('KWT-YTS-2026-ABCDEF12');
    expect(callArg.html).toContain('TERVERIFIKASI SAH');

    spy.mockRestore();
  });

  it('renders waqf inquiry and staff welcome email templates', async () => {
    const spy = vi.spyOn(getTransporter(), 'sendMail').mockResolvedValue({
      messageId: 'test-multi-id',
    } as any);

    // Waqf
    const waqfRes = await sendWaqfInquiryConfirmationEmail({
      recipientEmail: 'wakif@example.com',
      wakifName: 'Ahmad Subarkah',
      waqfType: 'tanah',
      estimatedValue: 1000000000,
      cityRegency: 'Kab. Bandung',
      inquiryCode: 'WQF-260825-WXYZ',
    });
    expect(waqfRes.success).toBe(true);

    // Staff Welcome
    const staffRes = await sendStaffWelcomeEmail({
      recipientEmail: 'staf@tarbiyahsunnah.id',
      fullName: 'Ahmad Fauzi',
      assignedRoles: ['Admin Kajian & Acara', 'CS Jamaah Care'],
      loginUrl: 'https://yts.web.id/login',
    });
    expect(staffRes.success).toBe(true);

    // Test Email
    const testRes = await sendTestEmail('admin@tarbiyahsunnah.id');
    expect(testRes.success).toBe(true);

    spy.mockRestore();
  });
});
