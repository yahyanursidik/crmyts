export const BAZAAR_CATEGORIES = [
  "kuliner",
  "busana_muslim",
  "buku_kitab",
  "herbal_kesehatan",
  "pendidikan",
  "travel_umroh",
  "properti_syariah",
  "jasa_keuangan",
  "aksesoris",
  "lainnya",
] as const;
export const BAZAAR_CATEGORY_LABELS: Record<string, string> = {
  kuliner: "Kuliner & minuman",
  busana_muslim: "Busana Muslim",
  buku_kitab: "Buku & kitab",
  herbal_kesehatan: "Herbal & kesehatan",
  pendidikan: "Pendidikan",
  travel_umroh: "Travel umrah / haji",
  properti_syariah: "Properti syariah",
  jasa_keuangan: "Jasa syariah",
  aksesoris: "Perlengkapan & aksesori",
  lainnya: "Lainnya",
};
export const BAZAAR_STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  submitted: "Pendaftar baru",
  under_review: "Dalam tinjauan",
  accepted: "Diterima",
  waitlist: "Daftar tunggu",
  rejected: "Ditolak",
  payment_pending: "Menunggu pembayaran",
  payment_verification: "Periksa pembayaran",
  payment_verified: "Terverifikasi",
  booth_assigned: "Stan ditetapkan",
  checked_in: "Hadir",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
export const BAZAAR_PLACED = ["booth_assigned", "checked_in", "completed"];
export const BAZAAR_QUOTA_STATES = [
  "submitted",
  "under_review",
  "accepted",
  "payment_pending",
  "payment_verification",
  "payment_verified",
  ...BAZAAR_PLACED,
];
export function bazaarPaymentConfirmed(app: {
  infaqAmountRupiah: number;
  status: string;
  paymentVerifiedAt?: unknown;
}) {
  return (
    ["payment_verified", ...BAZAAR_PLACED].includes(app.status) &&
    (app.infaqAmountRupiah === 0 || !!app.paymentVerifiedAt)
  );
}
export function bazaarBankConfigured(bank: {
  paymentEnabled?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
}) {
  return (
    bank.paymentEnabled === true &&
    !!bank.bankName?.trim() &&
    !!bank.bankAccountName?.trim() &&
    /^\d{5,30}$/.test(bank.bankAccountNumber?.replace(/[\s-]/g, "") || "") &&
    !["7144778899", "1234567890", "0000000000"].includes(
      bank.bankAccountNumber?.replace(/[\s-]/g, "") || "",
    )
  );
}
export function bazaarRegistrationOpen(
  bazaar: { isOpen: boolean; registrationDeadline?: string | Date | null },
  event?: {
    status?: string;
    startAt: string | Date;
    endAt?: string | Date | null;
  } | null,
  now = Date.now(),
) {
  return (
    !!event &&
    event.status !== "cancelled" &&
    event.status !== "completed" &&
    bazaar.isOpen &&
    (!bazaar.registrationDeadline ||
      +new Date(bazaar.registrationDeadline) >= now) &&
    +new Date(event.endAt || new Date(+new Date(event.startAt) + 10_800_000)) >=
      now
  );
}
export function bazaarElectricityFee(needed: boolean, watts: number) {
  const tiers: Record<number, number> = {
    0: 0,
    450: 0,
    900: 50000,
    1300: 100000,
    2200: 175000,
  };
  return needed ? (tiers[watts] ?? null) : 0;
}
