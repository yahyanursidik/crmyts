import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Unit: Input Validation & Zod Schemas (CRM YTS)', () => {
  const donationInputSchema = z.object({
    personId: z.string().uuid('ID Jamaah wajib format UUID'),
    programId: z.string().uuid('ID Program wajib format UUID'),
    donationDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    amountRupiah: z.number().int().positive('Nominal donasi harus lebih dari Rp 0'),
    paymentMethod: z.enum(['bank_transfer', 'qris', 'cash', 'other']),
    reference: z.string().optional(),
    proofAttachmentId: z.string().uuid().optional(),
    notes: z.string().optional(),
  });

  const interactionLogSchema = z.object({
    personId: z.string().uuid('ID Jamaah wajib format UUID'),
    channel: z.enum(['whatsapp', 'phone', 'in_person', 'email', 'social_media', 'other']),
    summary: z.string().min(3, 'Ringkasan sapaan wajib diisi'),
    outcome: z.enum([
      'Sudah Dihubungi',
      'Tidak Merespons',
      'Minta Dihubungi Kembali',
      'Berminat',
      'Belum Berminat',
      'Selesai',
      'Perlu Eskalasi',
    ]),
    sensitivity: z.enum(['normal', 'high', 'restricted']).default('normal'),
    nextAction: z.object({
      title: z.string().min(3),
      dueAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    }).optional(),
  });

  it('Validates donation input correctly', () => {
    const validDonation = {
      personId: '018f0000-0000-7000-8000-000000000001',
      programId: '018f0000-0000-7000-8000-000000000002',
      donationDate: '2026-08-15T00:00:00.000Z',
      amountRupiah: 1000000,
      paymentMethod: 'bank_transfer',
      reference: 'TRX-12345',
    };

    const parsed = donationInputSchema.safeParse(validDonation);
    expect(parsed.success).toBe(true);

    const invalidAmount = {
      ...validDonation,
      amountRupiah: -50000,
    };
    expect(donationInputSchema.safeParse(invalidAmount).success).toBe(false);

    const invalidUuid = {
      ...validDonation,
      personId: 'invalid-id',
    };
    expect(donationInputSchema.safeParse(invalidUuid).success).toBe(false);
  });

  it('Validates interaction input and optional next action task', () => {
    const validInteraction = {
      personId: '018f0000-0000-7000-8000-000000000001',
      channel: 'whatsapp',
      summary: 'Konfirmasi pendaftaran kajian akbar akhir pekan',
      outcome: 'Berminat',
      sensitivity: 'normal',
      nextAction: {
        title: 'Kirim link grup kajian',
        dueAt: '2026-08-16T10:00:00.000Z',
        priority: 'normal',
      },
    };

    expect(interactionLogSchema.safeParse(validInteraction).success).toBe(true);

    const invalidOutcome = {
      ...validInteraction,
      outcome: 'InvalidOutcomeName',
    };
    expect(interactionLogSchema.safeParse(invalidOutcome).success).toBe(false);
  });
});
