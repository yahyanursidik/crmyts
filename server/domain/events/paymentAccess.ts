import { isStaffRegistration } from "./registrationChannels";
export const PENDING_PAYMENT_STATUSES = [
  "pending_payment",
  "waiting_verification",
  "rejected",
] as const;

export function paymentCheckInError(
  attendance: {
    paymentStatus?: string | null;
    registrationData?: Record<string, unknown> | null;
  },
  eventIsPaid = false,
): string | null {
  const staffExemption =
    attendance.paymentStatus === "free" && isStaffRegistration(attendance);
  return (eventIsPaid &&
    attendance.paymentStatus !== "verified" &&
    !staffExemption) ||
    PENDING_PAYMENT_STATUSES.some(
      (status) => status === attendance.paymentStatus,
    )
    ? "Pembayaran belum disetujui. Verifikasi pembayaran sebelum check-in."
    : null;
}
