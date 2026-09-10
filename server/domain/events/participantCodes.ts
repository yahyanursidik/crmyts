import { randomInt } from 'node:crypto';

const MEMORABLE_WORDS = [
  'ADAB', 'AMAN', 'BAIK', 'BINA', 'CAHAYA', 'DAKWAH', 'FAJAR', 'HIKMAH',
  'ILMU', 'IKHLAS', 'INSAN', 'KAWAN', 'LENTERA', 'MAJLIS', 'NUR', 'RAHMA',
  'SABAR', 'SAHABAT', 'SALAM', 'SANTUN', 'SIRAJ', 'TAQWA', 'UMAT', 'WAFI',
] as const;

function pickWord(): string {
  return MEMORABLE_WORDS[randomInt(MEMORABLE_WORDS.length)]!;
}

function pickDigits(): string {
  return String(randomInt(10000)).padStart(4, '0');
}

/** Kode yang cukup singkat untuk disebutkan langsung di meja check-in. */
export function createMemorableTicketCode(): string {
  return `YTS-${pickWord()}-${pickWord()}-${pickDigits()}`;
}

/** Kode undangan tidak sama dengan kode tiket agar aman dibagikan. */
export function createReferralCode(): string {
  return `AJAK-${pickWord()}-${pickWord()}-${pickDigits()}`;
}
