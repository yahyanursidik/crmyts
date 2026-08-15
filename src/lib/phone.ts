/**
 * Client-Side E.164 Phone Normalization & WhatsApp Link Helper
 */

export function normalizePhoneE164(rawPhone?: string | null, defaultCountryCode: string = '62'): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return null;
  }

  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('0')) {
    cleaned = `${defaultCountryCode}${cleaned.substring(1)}`;
  } else if (!cleaned.startsWith(defaultCountryCode) && cleaned.length <= 11) {
    if (cleaned.startsWith('8')) {
      cleaned = `${defaultCountryCode}${cleaned}`;
    }
  }

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

export function getWhatsAppLink(phoneE164?: string | null, message?: string): string | null {
  if (!phoneE164) return null;
  const digits = phoneE164.replace(/[^\d]/g, '');
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return base;
}
