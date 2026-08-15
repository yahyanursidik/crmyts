/**
 * Indonesian & Global E.164 Phone Normalization Utility
 * Standardizes raw user input into canonical E.164 format (+628xxxx)
 */

export function normalizePhoneE164(rawPhone?: string | null, defaultCountryCode: string = '62'): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return null;
  }

  // Strip all non-digit characters except leading +
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');

  if (!cleaned) return null;

  // Handle + prefix
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Handle leading 0 (e.g. 08123456789 -> 628123456789)
  if (cleaned.startsWith('0')) {
    cleaned = `${defaultCountryCode}${cleaned.substring(1)}`;
  } else if (!cleaned.startsWith(defaultCountryCode) && cleaned.length <= 11) {
    // If entered without 0 or 62 (e.g. 8123456789)
    if (cleaned.startsWith('8')) {
      cleaned = `${defaultCountryCode}${cleaned}`;
    }
  }

  // Basic sanity check: valid E.164 has 8 to 15 digits
  if (cleaned.length < 8 || cleaned.length > 15) {
    return null;
  }

  return `+${cleaned}`;
}

export const normalizeIndonesianPhone = (phone?: string | null): string => {
  return normalizePhoneE164(phone, '62') || (phone || '').trim();
};

export function isValidE164(phone?: string | null): boolean {
  if (!phone || typeof phone !== 'string') return false;
  return /^\+[1-9]\d{7,14}$/.test(phone.trim());
}

/**
 * Format phone for display (e.g., +62 812-3456-7890)
 */
export function formatPhoneDisplay(e164Phone?: string | null): string {
  if (!e164Phone) return '-';
  if (e164Phone.startsWith('+62')) {
    const rest = e164Phone.substring(3);
    if (rest.length >= 9) {
      return `+62 ${rest.substring(0, 3)}-${rest.substring(3, 7)}-${rest.substring(7)}`;
    }
    return `+62 ${rest}`;
  }
  return e164Phone;
}
