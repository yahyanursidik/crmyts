import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getServerEnv } from '../config/env';

let _transporter: Transporter | null = null;

/**
 * Returns a configured Nodemailer Transporter instance for Kerjamail SMTP
 */
export function getTransporter(): Transporter {
  if (!_transporter) {
    const env = getServerEnv();
    _transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // true for port 465 SSL, false for 587 STARTTLS
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false, // Prevents self-signed / sub-domain SSL rejection
      },
    });
  }
  return _transporter;
}

/**
 * Verifies live connectivity with the Kerjamail SMTP server
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const transporter = getTransporter();
    await transporter.verify();
    const latencyMs = Date.now() - start;
    return { success: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    console.error('[SMTP Verify Error]:', err);
    return { success: false, latencyMs, error: err?.message || 'Gagal terhubung ke server SMTP' };
  }
}

/**
 * Wraps content in the official Yayasan Tarbiyah Sunnah responsive Islamic email layout
 */
export function renderEmailLayout(title: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f5ef; color: #1e293b; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e7e4d8; box-shadow: 0 10px 25px rgba(28, 50, 29, 0.06); }
    .top-bar { height: 6px; background: linear-gradient(90deg, #1c321d 0%, #efa914 50%, #2e5b32 100%); }
    .header { padding: 32px 32px 24px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f0eee6; }
    .header h1 { margin: 12px 0 2px; font-size: 22px; font-weight: 800; color: #1c321d; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 12px; font-weight: 600; color: #887d6b; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }
    .card { background-color: #fbfaf6; border: 1px solid #e8e4d9; border-radius: 14px; padding: 20px; margin: 20px 0; }
    .data-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2dec9; font-size: 13px; }
    .data-row:last-child { border-bottom: none; }
    .data-label { color: #64748b; font-weight: 500; }
    .data-value { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background-color: #1c321d; color: #ffffff !important; font-weight: 700; font-size: 13px; padding: 12px 28px; border-radius: 12px; text-decoration: none; margin: 20px 0 10px; text-align: center; }
    .btn-gold { background-color: #d87114; }
    .badge { display: inline-block; padding: 4px 12px; background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 11px; font-weight: 700; }
    .footer { padding: 24px 32px; background-color: #fbfaf6; border-top: 1px solid #f0eee6; font-size: 11px; color: #78716c; text-align: center; line-height: 1.5; }
    .footer strong { color: #292524; }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-bar"></div>
    <div class="header">
      <h1 style="color: #1c321d; margin-top: 4px;">Yayasan Tarbiyah Sunnah</h1>
      <p>Pusat Dakwah Sunnah, Majelis Ilmu & Pengelolaan Amanah Umat</p>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <strong>Yayasan Tarbiyah Sunnah (YTS)</strong><br>
      Kantor: Jl. Radio No. 1, Cililin, Kab. Bandung Barat, Jawa Barat 40562<br>
      Layanan WhatsApp Resmi: +62 811-2233-4455 | Email: info@tarbiyahsunnah.id<br>
      <span style="display:inline-block; margin-top: 8px; color: #a8a29e;">
        Email ini dikirim otomatis oleh Sistem CRM Resmi YTS melalui <code>no-reply@yts.web.id</code>.
      </span>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Low-level send mail function
 */
export async function sendEmail(options: SendMailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const env = getServerEnv();
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
      replyTo: options.replyTo || 'info@tarbiyahsunnah.id',
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('[SendEmail Error]:', err);
    return { success: false, error: err?.message || 'Gagal mengirim email' };
  }
}

/**
 * 1. Send E-Ticket Registration Email for Majelis Ilmu / Kajian
 */
export async function sendEventRegistrationTicketEmail(params: {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  speaker: string;
  startAtFormatted: string;
  locationName: string;
  ticketCode: string;
  gender: 'ikhwan' | 'akhwat';
  familyCount?: number;
  isPaid?: boolean;
  priceRupiah?: number;
  eventUrl: string;
}) {
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge">E-TIKET RESMI TERKONFIRMASI</span>
      <h2 style="font-size: 20px; font-weight: 800; color: #1c321d; margin: 12px 0 4px;">
        Konfirmasi Pendaftaran Majelis Ilmu
      </h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Bismillah, ahlan wa sahlan <strong>${params.recipientName}</strong>. Pendaftaran Anda telah berhasil dicatat.
      </p>
    </div>

    <div class="card" style="border: 2px solid #1c321d; background: #ffffff;">
      <div style="text-align: center; padding-bottom: 12px; border-bottom: 2px dashed #e2dec9;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Kode E-Tiket Masuk:</span>
        <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #1c321d; letter-spacing: 2px; margin-top: 4px;">
          ${params.ticketCode}
        </div>
      </div>

      <div style="padding-top: 14px;">
        <div class="data-row">
          <span class="data-label">Tema Kajian</span>
          <span class="data-value" style="color: #1c321d;">${params.eventTitle}</span>
        </div>
        <div class="data-row">
          <span class="data-label">Pemateri</span>
          <span class="data-value">${params.speaker}</span>
        </div>
        <div class="data-row">
          <span class="data-label">Waktu Pelaksanaan</span>
          <span class="data-value">${params.startAtFormatted}</span>
        </div>
        <div class="data-row">
          <span class="data-label">Lokasi / Tempat</span>
          <span class="data-value">${params.locationName}</span>
        </div>
        <div class="data-row">
          <span class="data-label">Kategori Peserta</span>
          <span class="data-value" style="text-transform: capitalize;">${params.gender} ${params.familyCount ? `(+${params.familyCount} Anggota Keluarga)` : ''}</span>
        </div>
        ${
          params.isPaid
            ? `
        <div class="data-row">
          <span class="data-label">Status Biaya</span>
          <span class="data-value" style="color: #047857;">Rp ${params.priceRupiah?.toLocaleString('id-ID')} (Terkonfirmasi)</span>
        </div>
        `
            : ''
        }
      </div>
    </div>

    <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
      💡 <em>Catatan: Harap simpan email ini atau catat Kode E-Tiket Anda untuk ditunjukkan kepada petugas registrasi saat tiba di lokasi majelis.</em>
    </p>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${params.eventUrl}" class="btn" target="_blank">Lihat Detail Majelis di Portal</a>
    </div>
  `;

  return sendEmail({
    to: params.recipientEmail,
    subject: `[E-Tiket] Konfirmasi Pendaftaran: ${params.eventTitle} — YTS`,
    html: renderEmailLayout(`E-Tiket Kajian: ${params.eventTitle}`, content),
  });
}

/**
 * 2. Send Infaq / Donation Received & Bank Transfer Instructions Email
 */
export async function sendDonationReceivedEmail(params: {
  recipientEmail: string;
  donorName: string;
  programName: string;
  amountRupiah: number;
  donationCode: string;
  paymentMethod: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}) {
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge">KONFIRMASI INFAQ DAKWAH</span>
      <h2 style="font-size: 20px; font-weight: 800; color: #1c321d; margin: 12px 0 4px;">
        Terima Kasih Atas Niat Mulia Anda
      </h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Bismillah, <strong>${params.donorName}</strong>. Komitmen infaq Anda telah tercatat dalam sistem perbendaharaan YTS.
      </p>
    </div>

    <div class="card">
      <div class="data-row">
        <span class="data-label">Nomor Transaksi</span>
        <span class="data-value" style="font-family: monospace;">${params.donationCode}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Peruntukan Program</span>
        <span class="data-value">${params.programName}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Jumlah Infaq</span>
        <span class="data-value" style="font-size: 16px; color: #047857;">Rp ${params.amountRupiah.toLocaleString('id-ID')}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Metode Penyaluran</span>
        <span class="data-value" style="text-transform: capitalize;">${params.paymentMethod.replace('_', ' ')}</span>
      </div>
    </div>

    ${
      params.accountNumber
        ? `
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px; text-align: center; margin: 20px 0;">
      <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Rekening Resmi Penampung Infaq:</span>
      <div style="font-size: 18px; font-weight: 800; color: #14532d; margin: 6px 0 2px;">${params.bankName || 'Bank Syariah Indonesia (BSI)'}</div>
      <div style="font-size: 22px; font-weight: 900; font-family: monospace; color: #052e16; letter-spacing: 1.5px;">${params.accountNumber}</div>
      <div style="font-size: 12px; color: #166534; margin-top: 4px;">a.n. ${params.accountHolder || 'Yayasan Tarbiyah Sunnah'}</div>
    </div>
    `
        : ''
    }

    <p style="font-size: 13px; color: #475569; text-align: center; font-style: italic; margin-top: 16px;">
      "Semoga Allah Subhanahu wa Ta'ala melipatgandakan pahala kebaikan Anda dan menjadikannya pemberat timbangan amal di yaumil akhir."
    </p>
  `;

  return sendEmail({
    to: params.recipientEmail,
    subject: `[Infaq YTS] Konfirmasi Penyaluran: Rp ${params.amountRupiah.toLocaleString('id-ID')} (${params.programName})`,
    html: renderEmailLayout('Konfirmasi Infaq Dakwah YTS', content),
  });
}

/**
 * 3. Send Official Verified Donation Receipt Email
 */
export async function sendDonationVerifiedReceiptEmail(params: {
  recipientEmail: string;
  donorName: string;
  programName: string;
  amountRupiah: number;
  receiptNumber: string;
  verifiedAtFormatted: string;
}) {
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge" style="background-color: #dbeafe; color: #1e40af; border-color: #bfdbfe;">KUITANSI RESMI TERCATAT</span>
      <h2 style="font-size: 20px; font-weight: 800; color: #1c321d; margin: 12px 0 4px;">
        Tanda Terima Sah Infaq & Donasi
      </h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Dana infaq dari <strong>${params.donorName}</strong> telah diverifikasi dan masuk ke rekening kas yayasan.
      </p>
    </div>

    <div class="card" style="border: 2px solid #047857; background: #ffffff;">
      <div class="data-row">
        <span class="data-label">Nomor Kuitansi</span>
        <span class="data-value" style="font-family: monospace; color: #047857;">${params.receiptNumber}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Diterima Dari</span>
        <span class="data-value">${params.donorName}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Peruntukan Dana</span>
        <span class="data-value">${params.programName}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Jumlah Bersih</span>
        <span class="data-value" style="font-size: 18px; color: #047857;">Rp ${params.amountRupiah.toLocaleString('id-ID')}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Waktu Verifikasi</span>
        <span class="data-value">${params.verifiedAtFormatted}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Status Keabsahan</span>
        <span class="data-value" style="color: #047857;">✓ TERVERIFIKASI SAH</span>
      </div>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center;">
      Dokumen ini merupakan bukti kuitansi digital resmi dari Yayasan Tarbiyah Sunnah.<br>
      <em>Jazaakumullahu Khairan Katsiran wa Barakallahu Fiikum.</em>
    </p>
  `;

  return sendEmail({
    to: params.recipientEmail,
    subject: `[Kuitansi Sah] Tanda Terima Infaq Rp ${params.amountRupiah.toLocaleString('id-ID')} — YTS`,
    html: renderEmailLayout('Kuitansi Sah Donasi YTS', content),
  });
}

/**
 * 4. Send Waqf Inquiry Confirmation Email
 */
export async function sendWaqfInquiryConfirmationEmail(params: {
  recipientEmail: string;
  wakifName: string;
  waqfType: string;
  estimatedValue?: number | null;
  cityRegency?: string | null;
  inquiryCode: string;
}) {
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge" style="background-color: #fef3c7; color: #92400e; border-color: #fde68a;">KONSULTASI WAKAF ABADI</span>
      <h2 style="font-size: 20px; font-weight: 800; color: #92400e; margin: 12px 0 4px;">
        Permohonan Konsultasi Wakaf Diterima
      </h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Bismillah, <strong>${params.wakifName}</strong>. Tim Divisi Wakaf YTS telah menerima niat baik amanah wakaf Anda.
      </p>
    </div>

    <div class="card">
      <div class="data-row">
        <span class="data-label">ID Konsultasi</span>
        <span class="data-value" style="font-family: monospace;">${params.inquiryCode}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Bentuk Aset Wakaf</span>
        <span class="data-value" style="text-transform: capitalize;">Wakaf ${params.waqfType}</span>
      </div>
      ${
        params.estimatedValue
          ? `
      <div class="data-row">
        <span class="data-label">Estimasi Nilai</span>
        <span class="data-value">Rp ${params.estimatedValue.toLocaleString('id-ID')}</span>
      </div>
      `
          : ''
      }
      ${
        params.cityRegency
          ? `
      <div class="data-row">
        <span class="data-label">Domisili / Lokasi</span>
        <span class="data-value">${params.cityRegency}</span>
      </div>
      `
          : ''
      }
    </div>

    <p style="font-size: 13px; color: #334155; line-height: 1.6;">
      Tim Amil & Nadzir Wakaf Yayasan Tarbiyah Sunnah akan segera menghubungi Anda melalui WhatsApp atau telepon untuk menindaklanjuti proses akad ikrar wakaf, verifikasi legalitas, dan peruntukan dakwah.
    </p>
  `;

  return sendEmail({
    to: params.recipientEmail,
    subject: `[Amanah Wakaf] Konfirmasi Konsultasi Wakaf: ${params.wakifName} — YTS`,
    html: renderEmailLayout('Konsultasi Wakaf Tarbiyah Sunnah', content),
  });
}

/**
 * 5. Send Staff User Welcome & Account Invitation Email
 */
export async function sendStaffWelcomeEmail(params: {
  recipientEmail: string;
  fullName: string;
  assignedRoles: string[];
  loginUrl: string;
}) {
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge">AKUN STAF RESMI CRM</span>
      <h2 style="font-size: 20px; font-weight: 800; color: #1c321d; margin: 12px 0 4px;">
        Pendaftaran Akun Pengurus / Amil
      </h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Ahlan wa Sahlan, <strong>${params.fullName}</strong>. Akun Anda di Sistem CRM Yayasan Tarbiyah Sunnah telah aktif.
      </p>
    </div>

    <div class="card">
      <div class="data-row">
        <span class="data-label">Email Login</span>
        <span class="data-value" style="font-family: monospace;">${params.recipientEmail}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Peran & Otoritas</span>
        <span class="data-value" style="color: #1c321d;">${params.assignedRoles.join(', ')}</span>
      </div>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.loginUrl}" class="btn" target="_blank">Buka Portal Login CRM</a>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center;">
      Jaga kerahasiaan kata sandi Anda dan selalu berpedoman pada amanah tata kelola yayasan.
    </p>
  `;

  return sendEmail({
    to: params.recipientEmail,
    subject: `[Akses Staf CRM] Selamat Datang di Sistem Yayasan Tarbiyah Sunnah`,
    html: renderEmailLayout('Akses Akun Staf CRM YTS', content),
  });
}

/**
 * 6. Send Live Test Email (Admin Tool in Settings)
 */
export async function sendTestEmail(recipientEmail: string) {
  const now = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' });
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="badge" style="background-color: #ecfdf5; color: #065f46;">UJI KONEKSI SMTP BERHASIL</span>
      <h2 style="font-size: 20px; font-weight: 800; color: #1c321d; margin: 12px 0 4px;">
        Server Email Kerjamail Siap Digunakan
      </h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Pesan ini membuktikan bahwa konfigurasi SMTP <code>no-reply@yts.web.id</code> berjalan 100% normal.
      </p>
    </div>

    <div class="card">
      <div class="data-row">
        <span class="data-label">Host SMTP</span>
        <span class="data-value" style="font-family: monospace;">mx.kerjamail.co</span>
      </div>
      <div class="data-row">
        <span class="data-label">Port & Enkripsi</span>
        <span class="data-value">465 (SSL Encrypted) / 587 (STARTTLS)</span>
      </div>
      <div class="data-row">
        <span class="data-label">Sender Email</span>
        <span class="data-value" style="font-family: monospace; color: #1c321d;">no-reply@yts.web.id</span>
      </div>
      <div class="data-row">
        <span class="data-label">Waktu Pengujian</span>
        <span class="data-value">${now}</span>
      </div>
    </div>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `[Uji Sistem] Notifikasi Pengujian Email SMTP Yayasan Tarbiyah Sunnah`,
    html: renderEmailLayout('Uji Coba Email SMTP YTS', content),
  });
}
