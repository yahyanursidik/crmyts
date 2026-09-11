import { randomInt } from 'node:crypto';

/**
 * Format tiket ringkas & ramah: `YTS-` + 4 digit angka (misal `YTS-1001`, `YTS-1048`).
 * Jika nomor urut peserta diberikan (misal peserta ke-1), menghasilkan `YTS-1001`.
 * Jika tanpa parameter urutan, menghasilkan 4 digit angka (1000 - 9999).
 */
export function createMemorableTicketCode(indexOrSeq?: number): string {
  if (typeof indexOrSeq === 'number' && indexOrSeq > 0) {
    const num = indexOrSeq >= 1000 ? indexOrSeq : 1000 + indexOrSeq;
    return `YTS-${num}`;
  }
  const digits = randomInt(1000, 10000);
  return `YTS-${digits}`;
}

/**
 * Kode undangan / referral ringkas: `AJAK-` + 4 digit angka (misal `AJAK-1001`, `AJAK-4821`).
 */
export function createReferralCode(indexOrSeq?: number): string {
  if (typeof indexOrSeq === 'number' && indexOrSeq > 0) {
    const num = indexOrSeq >= 1000 ? indexOrSeq : 1000 + indexOrSeq;
    return `AJAK-${num}`;
  }
  const digits = randomInt(1000, 10000);
  return `AJAK-${digits}`;
}

