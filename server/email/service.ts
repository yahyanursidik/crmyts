import { randomUUID } from 'node:crypto';
import { getServerEnv } from '../config/env';

const MAILKETING_TIMEOUT_MS = 10_000;

type MailketingApiResponse = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
  data?: { message_id?: string; credits?: number };
};

function readMailketingError(payload: MailketingApiResponse | null, fallback: string): string {
  if (payload?.message) return payload.message;
  const firstError = payload?.errors && Object.values(payload.errors).flat()[0];
  return typeof firstError === 'string' ? firstError : fallback;
}

async function mailketingRequest(url: string, init: RequestInit): Promise<{ response: Response; payload: MailketingApiResponse | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAILKETING_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let payload: MailketingApiResponse | null = null;
    try {
      payload = raw ? JSON.parse(raw) as MailketingApiResponse : null;
    } catch {
      // The status code still gives a safe failure result if the upstream response is not JSON.
    }
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function mailketingHeaders(apiToken: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Api-Token': apiToken,
  };
}

/** Verifies the Mailketing API token without sending an email. */
export async function verifyMailketingConnection(): Promise<{ success: boolean; latencyMs: number; error?: string; credits?: number }> {
  const start = Date.now();
  const env = getServerEnv();
  if (!env.MAILKETING_API_TOKEN) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: 'MAILKETING_API_TOKEN belum dikonfigurasi pada environment server.',
    };
  }

  try {
    const creditsUrl = new URL('credits', env.MAILKETING_API_ENDPOINT).toString();
    const { response, payload } = await mailketingRequest(creditsUrl, {
      method: 'GET',
      headers: mailketingHeaders(env.MAILKETING_API_TOKEN),
    });
    const latencyMs = Date.now() - start;
    if (!response.ok || payload?.success === false) {
      return { success: false, latencyMs, error: readMailketingError(payload, `Mailketing merespons HTTP ${response.status}.`) };
    }
    return { success: true, latencyMs, credits: payload?.data?.credits };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const isTimeout = err?.name === 'AbortError';
    console.error('[Mailketing Verify Error]:', err?.message || err);
    return { success: false, latencyMs, error: isTimeout ? 'Koneksi Mailketing melebihi batas waktu.' : 'Gagal terhubung ke API Mailketing.' };
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
      <p>Bersama Sunnah, Menebar Manfaat</p>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <strong>Yayasan Tarbiyah Sunnah (YTS)</strong><br>
      Kantor: Jl. Jurang No.64, Pasteur, Kec. Sukajadi, Kota Bandung, Jawa Barat 40161<br>
      WhatsApp Resmi: 0811-2401-476 | Bila ada error atau mendapatkan pesan yang salah silahkan kirim Email Stafsus IT, Inovasi dan Busdev YTS: <a href="mailto:ahlan@yahyanursidik.my.id" style="color: #047857; text-decoration: underline; font-weight: 600;">ahlan@yahyanursidik.my.id</a><br>
      <span style="display:inline-block; margin-top: 8px; color: #a8a29e;">
        Email ini dikirim otomatis oleh Sistem CRM Resmi YTS melalui <a href="mailto:no-reply@yts.web.id" style="color: #047857; text-decoration: none; font-weight: 600;">no-reply@yts.web.id</a>.
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
  const env = getServerEnv();
  if (!env.MAILKETING_API_TOKEN) {
    return { success: false, error: 'MAILKETING_API_TOKEN belum dikonfigurasi pada environment server.' };
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  if (recipients.length === 0) {
    return { success: false, error: 'Alamat email penerima wajib diisi.' };
  }

  try {
    const results = await Promise.all(recipients.map(async (recipient) => {
      const messageId = `yts-${randomUUID()}`;
      const { response, payload } = await mailketingRequest(env.MAILKETING_API_ENDPOINT, {
        method: 'POST',
        headers: mailketingHeaders(env.MAILKETING_API_TOKEN),
        body: JSON.stringify({
          from_name: env.MAILKETING_FROM_NAME,
          from_email: env.MAILKETING_FROM_EMAIL,
          subject: options.subject,
          recipient,
          content: options.html,
          message_id: messageId,
        }),
      });

      if (!response.ok || payload?.success === false) {
        throw new Error(readMailketingError(payload, `Mailketing merespons HTTP ${response.status}.`));
      }
      return payload?.data?.message_id || messageId;
    }));

    return { success: true, messageId: results[0] };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    console.error('[Mailketing Send Error]:', err?.message || err);
    return { success: false, error: isTimeout ? 'Pengiriman email ke Mailketing melebihi batas waktu.' : err?.message || 'Gagal mengirim email melalui Mailketing.' };
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
  gender: 'ikhwan' | 'akhwat' | null;
  familyCount?: number;
  groupTickets?: Array<{ name: string; relationship: string; ticketCode: string }>;
  isPaid?: boolean;
  priceRupiah?: number;
  eventUrl: string;
}) {
  const groupSection =
    params.groupTickets && params.groupTickets.length > 1
      ? `
      <div style="margin-top: 16px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
        <span style="font-size: 11px; font-weight: 800; color: #1c321d; text-transform: uppercase; display: block; margin-bottom: 8px;">
          Daftar E-Tiket Rombongan (${params.groupTickets.length} Jamaah):
        </span>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f8fafc; color: #475569; text-align: left;">
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 11px;">Nama Jamaah</th>
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 11px;">Hubungan</th>
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 11px;">Kode Tiket</th>
            </tr>
          </thead>
          <tbody>
            ${params.groupTickets
              .map(
                (m) => `
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${m.name}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #64748b;">${m.relationship}</td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 700; color: #1c321d;">${m.ticketCode}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      `
      : '';

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
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Nomor E-Tiket Presensi:</span>
        <div style="font-size: 26px; font-weight: 900; font-family: monospace; color: #1c321d; letter-spacing: 2px; margin-top: 4px;">
          ${params.ticketCode}
        </div>
        <p style="font-size: 11px; color: #475569; margin: 4px 0 0;">(Cukup sebutkan nomor tiket ini atau tunjukkan QR kepada panitia di gerbang masuk)</p>
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
          <span class="data-value" style="text-transform: capitalize;">${params.gender === 'akhwat' ? 'Akhwat' : params.gender === 'ikhwan' ? 'Ikhwan' : 'Jamaah'} ${params.familyCount ? `(+${params.familyCount} Anggota Keluarga)` : ''}</span>
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
        ${groupSection}
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
      <span class="badge" style="background-color: #ecf5ef; color: #065f46;">UJI API MAILKETING BERHASIL</span>
      <h2 style="font-size: 20px; font-weight: 800; color: #1c321d; margin: 12px 0 4px;">
        Mailketing Siap Digunakan
      </h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Pesan ini membuktikan bahwa pengiriman melalui Mailketing dari <code>no-reply@yts.web.id</code> berjalan normal.
      </p>
    </div>

    <div class="card">
      <div class="data-row">
        <span class="data-label">Penyedia</span>
        <span class="data-value" style="font-family: monospace;">Mailketing API</span>
      </div>
      <div class="data-row">
        <span class="data-label">Endpoint</span>
        <span class="data-value" style="font-family: monospace;">/api/v2/send</span>
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
    subject: `[Uji Sistem] Notifikasi Pengujian Email Mailketing Yayasan Tarbiyah Sunnah`,
    html: renderEmailLayout('Uji Coba Email Mailketing YTS', content),
  });
}
