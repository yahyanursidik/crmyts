/**
 * Format QR tidak memuat data pribadi. Scanner boleh menerima kode mentah,
 * URL portal peserta yang memuat parameter `ticket`, maupun 4-6 digit angka langsung.
 */
export function extractTicketCode(rawValue: string): string {
  const raw = rawValue.trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const ticket = url.searchParams.get('ticket');
    if (ticket) {
      const cleanTicket = ticket.trim().toUpperCase();
      if (/^\d{4,6}$/.test(cleanTicket)) {
        return `YTS-${cleanTicket}`;
      }
      return cleanTicket;
    }
  } catch {
    // Barcode gun biasanya mengirim kode mentah, bukan URL.
  }

  const clean = raw.toUpperCase();
  // Jika panitia atau jamaah hanya mengetikkan 4-6 angka (misal '1048'), otomatis berikan prefix 'YTS-'
  if (/^\d{4,6}$/.test(clean)) {
    return `YTS-${clean}`;
  }

  return clean;
}

/** Mengambil hanya digit angka tiket untuk penyebutan lisan kilat di gerbang (misal: '1048') */
export function getTicketNumber(ticketCode: string): string {
  if (!ticketCode) return '';
  const match = ticketCode.match(/\d+$/);
  return match ? match[0] : ticketCode;
}

export function buildParticipantPortalPath(eventId: string, ticketCode: string): string {
  return `/peserta/${eventId}?ticket=${encodeURIComponent(ticketCode)}`;
}

/**
 * Normalisasi nomor HP ke format internasional WhatsApp (628...)
 * Jika nomor valid diberikan, menghasilkan tautan https://wa.me/...
 * Jika nomor kosong atau null, menghasilkan tautan https://api.whatsapp.com/send?text=... (pemilihan kontak bebas)
 */
export function buildWhatsAppShareUrl(text: string, phone?: string | null): string {
  if (phone) {
    let clean = phone.replace(/[^0-9+]/g, '');
    if (clean.startsWith('+')) {
      clean = clean.substring(1);
    }
    if (clean.startsWith('08')) {
      clean = '628' + clean.substring(2);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    if (/^628\d{7,12}$/.test(clean)) {
      return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
    }
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Menghasilkan tautan resmi Telegram Share (https://t.me/share/url?url=...&text=...)
 */
export function buildTelegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

function formatEventDateFriendly(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d) + ' WIB'
    );
  } catch {
    return dateStr;
  }
}

export interface FormatSingleTicketOptions {
  eventTitle: string;
  speaker?: string | null;
  startAt?: string | null;
  locationName?: string | null;
  participantName: string;
  relationship?: string | null;
  gender?: string | null;
  ticketCode: string;
  portalUrl: string;
  isSpecialInvite?: boolean;
}

/**
 * Format pesan ringkasan tiket untuk 1 orang jamaah
 */
export function formatTicketShareMessageSingle(options: FormatSingleTicketOptions): string {
  const parts: string[] = [];
  parts.push('*BUKTI PENDAFTARAN MAJELIS ILMU*');
  parts.push('_Yayasan Tarbiyah Sunnah_');
  parts.push('');
  parts.push(
    `Bismillah, pendaftaran atas nama *${options.participantName}*${
      options.relationship ? ` (${options.relationship})` : ''
    } telah berhasil dicatat.`
  );
  parts.push('');
  parts.push(`📌 *Kajian*: ${options.eventTitle}`);
  if (options.speaker) parts.push(`🎙️ *Pemateri*: ${options.speaker}`);
  if (options.startAt) parts.push(`🗓️ *Waktu*: ${formatEventDateFriendly(options.startAt)}`);
  if (options.locationName) parts.push(`📍 *Lokasi*: ${options.locationName}`);
  parts.push('');
  parts.push(`🎫 *Nomor E-Tiket*: ${options.ticketCode}`);
  if (options.isSpecialInvite) {
    parts.push('✨ *Jalur Undangan Khusus Resmi Panitia (VIP)*');
  }
  parts.push('');
  parts.push('📱 *Tautan Akses QR & Presensi Mandiri*:');
  parts.push(options.portalUrl);
  parts.push('');
  parts.push(
    '_Silakan simpan tiket ini dan tunjukkan QR Code pada tautan di atas atau sebutkan nomor tiket kepada panitia saat tiba di gerbang presensi._'
  );
  parts.push('');
  parts.push('Jazakumullahu khairan katsiran.');
  return parts.join('\n');
}

export interface GroupMemberTicketItem {
  name: string;
  relationship?: string | null;
  gender?: string | null;
  ticketCode: string;
  portalUrl: string;
}

export interface FormatGroupTicketsOptions {
  eventTitle: string;
  speaker?: string | null;
  startAt?: string | null;
  locationName?: string | null;
  registrantName: string;
  totalParticipants: number;
  groupTickets: GroupMemberTicketItem[];
  isSpecialInvite?: boolean;
}

/**
 * Format pesan ringkasan tiket kolektif untuk seluruh rombongan / keluarga
 */
export function formatTicketShareMessageGroup(options: FormatGroupTicketsOptions): string {
  const parts: string[] = [];
  parts.push('*BUKTI PENDAFTARAN ROMBONGAN / KELUARGA*');
  parts.push('_Yayasan Tarbiyah Sunnah_');
  parts.push('');
  parts.push(
    `Bismillah, pendaftaran rombongan atas nama *${options.registrantName}* (Total ${options.totalParticipants} Peserta) telah berhasil dicatat.`
  );
  parts.push('');
  parts.push(`📌 *Kajian*: ${options.eventTitle}`);
  if (options.speaker) parts.push(`🎙️ *Pemateri*: ${options.speaker}`);
  if (options.startAt) parts.push(`🗓️ *Waktu*: ${formatEventDateFriendly(options.startAt)}`);
  if (options.locationName) parts.push(`📍 *Lokasi*: ${options.locationName}`);
  if (options.isSpecialInvite) {
    parts.push('✨ *Jalur Undangan Khusus Resmi Panitia (VIP)*');
  }
  parts.push('');
  parts.push('📋 *DAFTAR TIKET & QR ANGGOTA ROMBONGAN*:');

  options.groupTickets.forEach((t, idx) => {
    parts.push('');
    parts.push(`${idx + 1}. *${t.name}*${t.relationship ? ` (${t.relationship})` : ''}`);
    parts.push(`   • No. Tiket: ${t.ticketCode}`);
    parts.push(`   • Link QR Presensi: ${t.portalUrl}`);
  });

  parts.push('');
  parts.push(
    '_Tiap anggota rombongan dapat menunjukkan QR Code masing-masing pada tautan di atas saat tiba di gerbang presensi._'
  );
  parts.push('');
  parts.push('Jazakumullahu khairan katsiran.');
  return parts.join('\n');
}


