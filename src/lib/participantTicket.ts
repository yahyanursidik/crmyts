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

