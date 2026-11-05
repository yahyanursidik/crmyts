export function eventScheduleError(value: {
  startAt: string | Date;
  endAt?: string | Date | null;
  isPaid?: boolean;
  priceRupiah?: number | null;
}): string | null {
  const start = new Date(value.startAt).getTime();
  const end = value.endAt ? new Date(value.endAt).getTime() : null;
  if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end)))
    return "Tanggal dan waktu tidak valid.";
  if (end !== null && end <= start)
    return "Waktu selesai harus setelah waktu mulai.";
  if (value.isPaid && !(Number(value.priceRupiah) > 0))
    return "Nominal event berbayar harus lebih dari Rp0.";
  return null;
}

/** Patch nested sections without erasing settings owned by another editor. */
export function mergeEventConfig(
  current: Record<string, any> | null | undefined,
  patch: Record<string, any> | null,
): Record<string, any> {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch || {})) {
    if (
      ["__proto__", "constructor", "prototype", "gateAccessToken"].includes(key)
    )
      continue;
    next[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? mergeEventConfig(current?.[key], value)
        : value;
  }
  return next;
}

export function attendanceHasHistory(
  attendance: {
    status?: string;
    paymentStatus?: string | null;
    paymentProofUrl?: string | null;
    checkInAt?: unknown;
  },
  isPaid = false,
): boolean {
  return (
    attendance.status === "attended" ||
    Boolean(attendance.checkInAt || attendance.paymentProofUrl) ||
    ["verified", "waiting_verification", "rejected"].includes(
      attendance.paymentStatus || "",
    ) ||
    (isPaid && attendance.paymentStatus === "free")
  );
}
