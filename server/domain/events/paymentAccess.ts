export const PENDING_PAYMENT_STATUSES = ['pending_payment', 'waiting_verification', 'rejected'] as const;

export function paymentCheckInError(attendance: { paymentStatus?: string | null }): string | null {
  return PENDING_PAYMENT_STATUSES.some((status) => status === attendance.paymentStatus)
    ? 'Pembayaran belum disetujui. Verifikasi pembayaran sebelum check-in.'
    : null;
}
