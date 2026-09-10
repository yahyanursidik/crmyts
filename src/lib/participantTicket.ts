/**
 * Format QR tidak memuat data pribadi. Scanner boleh menerima kode mentah
 * ataupun URL portal peserta yang memuat parameter `ticket`.
 */
export function extractTicketCode(rawValue: string): string {
  const raw = rawValue.trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const ticket = url.searchParams.get('ticket');
    if (ticket) return ticket.trim().toUpperCase();
  } catch {
    // Barcode gun biasanya mengirim kode mentah, bukan URL.
  }

  return raw.toUpperCase();
}

export function buildParticipantPortalPath(eventId: string, ticketCode: string): string {
  return `/peserta/${eventId}?ticket=${encodeURIComponent(ticketCode)}`;
}
