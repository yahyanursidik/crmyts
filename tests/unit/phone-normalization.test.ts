import { describe, it, expect } from 'vitest';
import { normalizePhoneE164, formatPhoneDisplay } from '../../server/lib/phone';
import { getWhatsAppLink } from '../../src/lib/phone';

describe('E.164 Phone Normalization & WhatsApp Helpers', () => {
  it('should normalize local 08xx number to +628xx', () => {
    expect(normalizePhoneE164('081234567890')).toBe('+6281234567890');
    expect(normalizePhoneE164('0812-3456-7890')).toBe('+6281234567890');
    expect(normalizePhoneE164('0812 3456 7890')).toBe('+6281234567890');
  });

  it('should normalize 628xx without plus to +628xx', () => {
    expect(normalizePhoneE164('6281234567890')).toBe('+6281234567890');
    expect(normalizePhoneE164('+6281234567890')).toBe('+6281234567890');
  });

  it('should normalize raw 8xx number to +628xx', () => {
    expect(normalizePhoneE164('81234567890')).toBe('+6281234567890');
  });

  it('should return null for invalid or too short inputs', () => {
    expect(normalizePhoneE164('')).toBeNull();
    expect(normalizePhoneE164(null)).toBeNull();
    expect(normalizePhoneE164('12345')).toBeNull();
    expect(normalizePhoneE164('abc-xyz')).toBeNull();
  });

  it('should format display phone correctly', () => {
    expect(formatPhoneDisplay('+6281234567890')).toBe('+62 812-3456-7890');
    expect(formatPhoneDisplay(null)).toBe('-');
  });

  it('should generate valid WhatsApp direct click links', () => {
    expect(getWhatsAppLink('+6281234567890')).toBe('https://wa.me/6281234567890');
    expect(getWhatsAppLink('+6281234567890', 'Assalamu alaikum')).toBe(
      'https://wa.me/6281234567890?text=Assalamu%20alaikum'
    );
  });
});
