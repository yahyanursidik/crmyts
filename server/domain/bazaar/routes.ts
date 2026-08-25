import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { events, bazaarEvents, bazaarBooths, bazaarTenants, persons } from '../../db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { normalizeIndonesianPhone } from '../../lib/phone';

let bazaarTablesInitialized = false;

async function ensureBazaarTablesExist(db: any) {
  if (bazaarTablesInitialized) return;
  try {
    if (typeof db.execute === 'function') {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS bazaar_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          title text NOT NULL,
          description text,
          is_open boolean DEFAULT true NOT NULL,
          rules_and_terms text,
          default_fee_rupiah integer DEFAULT 0 NOT NULL,
          bank_name text,
          bank_account_number text,
          bank_account_name text,
          payment_instructions text,
          layout_zones jsonb,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bazaar_booths (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          bazaar_id uuid NOT NULL REFERENCES bazaar_events(id) ON DELETE CASCADE,
          code text NOT NULL,
          name text NOT NULL,
          zone text DEFAULT 'Zona Utama' NOT NULL,
          size text DEFAULT '2x2 meter',
          facilities jsonb,
          price_rupiah integer DEFAULT 0 NOT NULL,
          allowed_category text DEFAULT 'all' NOT NULL,
          status text DEFAULT 'available' NOT NULL,
          position_x integer DEFAULT 0,
          position_y integer DEFAULT 0,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bazaar_tenants (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          bazaar_id uuid NOT NULL REFERENCES bazaar_events(id) ON DELETE CASCADE,
          booth_id uuid REFERENCES bazaar_booths(id) ON DELETE SET NULL,
          person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
          brand_name text NOT NULL,
          business_category text DEFAULT 'kuliner' NOT NULL,
          pic_name text NOT NULL,
          pic_phone text NOT NULL,
          pic_email text,
          pic_ktp_number text,
          social_media text,
          product_description text,
          electricity_needed boolean DEFAULT false NOT NULL,
          electricity_watts integer DEFAULT 0,
          special_requests text,
          status text DEFAULT 'pending_review' NOT NULL,
          infaq_amount_rupiah integer DEFAULT 0 NOT NULL,
          payment_proof_url text,
          payment_verified_at timestamp with time zone,
          payment_verified_by uuid REFERENCES app_users(id),
          rejection_reason text,
          admin_notes text,
          registered_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL
        );
      `);
    }
    bazaarTablesInitialized = true;
  } catch (err) {
    console.error('ensureBazaarTablesExist error:', err);
  }
}

const createBazaarSchema = z.object({
  title: z.string().min(3, 'Nama bazar minimal 3 karakter'),
  description: z.string().optional().nullable(),
  isOpen: z.boolean().default(true),
  rulesAndTerms: z.string().optional().nullable(),
  defaultFeeRupiah: z.number().int().min(0).default(0),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),
  layoutZones: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
  })).optional().nullable(),
});

const bulkCreateBoothsSchema = z.object({
  booths: z.array(z.object({
    code: z.string().min(1, 'Kode booth diperlukan'),
    name: z.string().min(1, 'Nama booth diperlukan'),
    zone: z.string().default('Zona Utama'),
    size: z.string().default('2x2 meter'),
    facilities: z.array(z.string()).default([]),
    priceRupiah: z.number().int().min(0).default(0),
    allowedCategory: z.string().default('all'),
    positionX: z.number().int().default(0),
    positionY: z.number().int().default(0),
  })).min(1, 'Minimal 1 booth'),
});

const updateBoothSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  zone: z.string().optional(),
  size: z.string().optional(),
  facilities: z.array(z.string()).optional(),
  priceRupiah: z.number().int().min(0).optional(),
  allowedCategory: z.string().optional(),
  status: z.enum(['available', 'reserved', 'booked', 'maintenance']).optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
});

const updateTenantStatusSchema = z.object({
  status: z.enum(['pending_review', 'approved_waiting_payment', 'verified', 'rejected', 'canceled']),
  boothId: z.string().uuid().optional().nullable(),
  infaqAmountRupiah: z.number().int().min(0).optional(),
  paymentProofUrl: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
});

const publicTenantRegisterSchema = z.object({
  boothId: z.string().uuid().optional().nullable(),
  brandName: z.string().min(2, 'Nama brand/usaha minimal 2 karakter'),
  businessCategory: z.string().min(2, 'Kategori usaha diperlukan'),
  picName: z.string().min(2, 'Nama penanggung jawab diperlukan'),
  picPhone: z.string().min(8, 'Nomor WhatsApp tidak valid'),
  picEmail: z.string().email('Format email tidak valid').optional().nullable().or(z.literal('')),
  picKtpNumber: z.string().optional().nullable(),
  socialMedia: z.string().optional().nullable(),
  productDescription: z.string().min(3, 'Deskripsi produk/menu diperlukan'),
  electricityNeeded: z.boolean().default(false),
  electricityWatts: z.number().int().min(0).default(0),
  specialRequests: z.string().optional().nullable(),
  infaqAmountRupiah: z.number().int().min(0).default(0),
  paymentProofUrl: z.string().optional().nullable(),
});

export function registerBazaarRoutes(router: Router) {
  // ========================================================
  // 1. GET /api/events/:id/bazaar (Admin Get Bazaar Config & Stats)
  // ========================================================
  router.get(
    '/api/events/:id/bazaar',
    requireAuth(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const eventId = ctx.params?.id;

      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      }

      const eventRecord = await db.query.events.findFirst({
        where: eq(events.id, eventId),
      });

      if (!eventRecord) {
        return errorResponse('NOT_FOUND', 'Jadwal kajian tidak ditemukan.', 404, ctx.requestId);
      }

      const bazaar = await db.query.bazaarEvents.findFirst({
        where: eq(bazaarEvents.eventId, eventId),
        with: {
          booths: {
            orderBy: [asc(bazaarBooths.zone), asc(bazaarBooths.code)],
          },
          tenants: {
            orderBy: [desc(bazaarTenants.registeredAt)],
            with: {
              booth: true,
              person: {
                columns: {
                  id: true,
                  fullName: true,
                  phoneE164: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return successResponse(
        {
          event: {
            id: eventRecord.id,
            title: eventRecord.title,
            startAt: eventRecord.startAt,
            speaker: eventRecord.speaker,
            locationName: eventRecord.locationName,
          },
          bazaar: bazaar || null,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // ========================================================
  // 2. POST /api/events/:id/bazaar (Initialize / Activate Bazaar)
  // ========================================================
  router.post(
    '/api/events/:id/bazaar',
    requireAuth(
      validateBody(createBazaarSchema, async (ctx, body) => {
        const db = getDb();
        await ensureBazaarTablesExist(db);
        const eventId = ctx.params?.id;

        if (!eventId) {
          return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
        }

        const eventRecord = await db.query.events.findFirst({
          where: eq(events.id, eventId),
        });

        if (!eventRecord) {
          return errorResponse('NOT_FOUND', 'Jadwal kajian tidak ditemukan.', 404, ctx.requestId);
        }

        const existingBazaar = await db.query.bazaarEvents.findFirst({
          where: eq(bazaarEvents.eventId, eventId),
        });

        if (existingBazaar) {
          return errorResponse('CONFLICT', 'Bazar untuk kajian ini sudah pernah diaktifkan.', 409, ctx.requestId);
        }

        const [created] = await db
          .insert(bazaarEvents)
          .values({
            eventId,
            title: body.title,
            description: body.description || null,
            isOpen: body.isOpen ?? true,
            rulesAndTerms: body.rulesAndTerms || null,
            defaultFeeRupiah: body.defaultFeeRupiah || 0,
            bankName: body.bankName || null,
            bankAccountNumber: body.bankAccountNumber || null,
            bankAccountName: body.bankAccountName || null,
            paymentInstructions: body.paymentInstructions || null,
            layoutZones: body.layoutZones || [
              { id: 'zone_selasar', name: 'Selasar Depan', description: 'Area Utama Ramai Jamaah', color: '#047857' },
              { id: 'zone_kuliner', name: 'Area Kuliner & Minuman', description: 'Dekat Tempat Wudhu & Parkir', color: '#b45309' },
              { id: 'zone_busana', name: 'Area Busana & Herbal', description: 'Selasar Samping Masjid', color: '#4338ca' },
            ],
          })
          .returning();

        return successResponse(created, { requestId: ctx.requestId });
      })
    )
  );

  // ========================================================
  // 3. PUT /api/events/:id/bazaar (Update Bazaar Settings)
  // ========================================================
  router.put(
    '/api/events/:id/bazaar',
    requireAuth(
      validateBody(createBazaarSchema.partial(), async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params?.id;

        if (!eventId) {
          return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
        }

        const existing = await db.query.bazaarEvents.findFirst({
          where: eq(bazaarEvents.eventId, eventId),
        });

        if (!existing) {
          return errorResponse('NOT_FOUND', 'Bazar belum diinisialisasi untuk kajian ini.', 404, ctx.requestId);
        }

        const [updated] = await db
          .update(bazaarEvents)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(bazaarEvents.id, existing.id))
          .returning();

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // ========================================================
  // 4. POST /api/events/:id/bazaar/booths/bulk (Generate Booth Slots)
  // ========================================================
  router.post(
    '/api/events/:id/bazaar/booths/bulk',
    requireAuth(
      validateBody(bulkCreateBoothsSchema, async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params?.id;

        if (!eventId) {
          return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
        }

        const bazaar = await db.query.bazaarEvents.findFirst({
          where: eq(bazaarEvents.eventId, eventId),
        });

        if (!bazaar) {
          return errorResponse('NOT_FOUND', 'Bazar belum diinisialisasi.', 404, ctx.requestId);
        }

        const values = body.booths.map((b) => ({
          bazaarId: bazaar.id,
          code: b.code.toUpperCase().trim(),
          name: b.name,
          zone: b.zone || 'Zona Utama',
          size: b.size || '2x2 meter',
          facilities: b.facilities || [],
          priceRupiah: b.priceRupiah || 0,
          allowedCategory: b.allowedCategory || 'all',
          status: 'available',
          positionX: b.positionX || 0,
          positionY: b.positionY || 0,
        }));

        const inserted = await db.insert(bazaarBooths).values(values).returning();

        return successResponse(inserted, { requestId: ctx.requestId });
      })
    )
  );

  // ========================================================
  // 5. PUT /api/events/:id/bazaar/booths/:boothId (Update Booth)
  // ========================================================
  router.put(
    '/api/events/:id/bazaar/booths/:boothId',
    requireAuth(
      validateBody(updateBoothSchema, async (ctx, body) => {
        const db = getDb();
        const boothId = ctx.params?.boothId;

        if (!boothId) {
          return errorResponse('VALIDATION_ERROR', 'Booth ID diperlukan.', 400, ctx.requestId);
        }

        const booth = await db.query.bazaarBooths.findFirst({
          where: eq(bazaarBooths.id, boothId),
        });

        if (!booth) {
          return errorResponse('NOT_FOUND', 'Slot booth tidak ditemukan.', 404, ctx.requestId);
        }

        const [updated] = await db
          .update(bazaarBooths)
          .set({
            ...body,
            code: body.code ? body.code.toUpperCase().trim() : undefined,
            updatedAt: new Date(),
          })
          .where(eq(bazaarBooths.id, boothId))
          .returning();

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // ========================================================
  // 6. DELETE /api/events/:id/bazaar/booths/:boothId (Delete Booth)
  // ========================================================
  router.delete(
    '/api/events/:id/bazaar/booths/:boothId',
    requireAuth(async (ctx) => {
      const db = getDb();
      const boothId = ctx.params?.boothId;

      if (!boothId) {
        return errorResponse('VALIDATION_ERROR', 'Booth ID diperlukan.', 400, ctx.requestId);
      }

      await db.delete(bazaarBooths).where(eq(bazaarBooths.id, boothId));

      return successResponse({ success: true }, { requestId: ctx.requestId });
    })
  );

  // ========================================================
  // 7. GET /api/events/:id/bazaar/tenants (List Tenants)
  // ========================================================
  router.get(
    '/api/events/:id/bazaar/tenants',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params?.id;

      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      }

      const bazaar = await db.query.bazaarEvents.findFirst({
        where: eq(bazaarEvents.eventId, eventId),
      });

      if (!bazaar) {
        return errorResponse('NOT_FOUND', 'Bazar tidak ditemukan.', 404, ctx.requestId);
      }

      const tenantsList = await db.query.bazaarTenants.findMany({
        where: eq(bazaarTenants.bazaarId, bazaar.id),
        orderBy: [desc(bazaarTenants.registeredAt)],
        with: {
          booth: true,
          person: true,
          verifiedBy: {
            columns: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      return successResponse(tenantsList, { requestId: ctx.requestId });
    })
  );

  // ========================================================
  // 8. PUT /api/events/:id/bazaar/tenants/:tenantId/status (Verify / Approve / Reject Tenant)
  // ========================================================
  router.put(
    '/api/events/:id/bazaar/tenants/:tenantId/status',
    requireAuth(
      validateBody(updateTenantStatusSchema, async (ctx, body) => {
        const db = getDb();
        const tenantId = ctx.params?.tenantId;
        const currentUserId = ctx.user?.id;

        if (!tenantId) {
          return errorResponse('VALIDATION_ERROR', 'Tenant ID diperlukan.', 400, ctx.requestId);
        }

        const tenant = await db.query.bazaarTenants.findFirst({
          where: eq(bazaarTenants.id, tenantId),
        });

        if (!tenant) {
          return errorResponse('NOT_FOUND', 'Data tenant tidak ditemukan.', 404, ctx.requestId);
        }

        const nextBoothId = body.boothId !== undefined ? body.boothId : tenant.boothId;

        // If verified, record verification timestamp and officer
        const isVerified = body.status === 'verified';
        const isRejectedOrCanceled = body.status === 'rejected' || body.status === 'canceled';

        const [updatedTenant] = await db
          .update(bazaarTenants)
          .set({
            status: body.status,
            boothId: nextBoothId,
            infaqAmountRupiah: body.infaqAmountRupiah !== undefined ? body.infaqAmountRupiah : tenant.infaqAmountRupiah,
            paymentProofUrl: body.paymentProofUrl !== undefined ? body.paymentProofUrl : tenant.paymentProofUrl,
            rejectionReason: body.rejectionReason !== undefined ? body.rejectionReason : tenant.rejectionReason,
            adminNotes: body.adminNotes !== undefined ? body.adminNotes : tenant.adminNotes,
            paymentVerifiedAt: isVerified ? new Date() : tenant.paymentVerifiedAt,
            paymentVerifiedBy: isVerified ? currentUserId : tenant.paymentVerifiedBy,
            updatedAt: new Date(),
          })
          .where(eq(bazaarTenants.id, tenantId))
          .returning();

        // Update Booth status accordingly
        if (nextBoothId) {
          if (isVerified) {
            await db.update(bazaarBooths).set({ status: 'booked' }).where(eq(bazaarBooths.id, nextBoothId));
          } else if (body.status === 'approved_waiting_payment') {
            await db.update(bazaarBooths).set({ status: 'reserved' }).where(eq(bazaarBooths.id, nextBoothId));
          } else if (isRejectedOrCanceled) {
            await db.update(bazaarBooths).set({ status: 'available' }).where(eq(bazaarBooths.id, nextBoothId));
          }
        }

        // If booth was changed from a previous booth, free the old booth
        if (tenant.boothId && tenant.boothId !== nextBoothId) {
          await db.update(bazaarBooths).set({ status: 'available' }).where(eq(bazaarBooths.id, tenant.boothId));
        }

        return successResponse(updatedTenant, { requestId: ctx.requestId });
      })
    )
  );

  // ========================================================
  // 9. DELETE /api/events/:id/bazaar/tenants/:tenantId (Delete Tenant)
  // ========================================================
  router.delete(
    '/api/events/:id/bazaar/tenants/:tenantId',
    requireAuth(async (ctx) => {
      const db = getDb();
      const tenantId = ctx.params?.tenantId;

      if (!tenantId) {
        return errorResponse('VALIDATION_ERROR', 'Tenant ID diperlukan.', 400, ctx.requestId);
      }

      const tenant = await db.query.bazaarTenants.findFirst({
        where: eq(bazaarTenants.id, tenantId),
      });

      if (tenant?.boothId) {
        await db.update(bazaarBooths).set({ status: 'available' }).where(eq(bazaarBooths.id, tenant.boothId));
      }

      await db.delete(bazaarTenants).where(eq(bazaarTenants.id, tenantId));

      return successResponse({ success: true }, { requestId: ctx.requestId });
    })
  );

  // ========================================================
  // 10. GET /api/public/events/:id/bazaar (Public View Bazaar & War Tempat Layout)
  // ========================================================
  router.get('/api/public/events/:id/bazaar', async (ctx) => {
    const db = getDb();
    await ensureBazaarTablesExist(db);
    const eventId = ctx.params?.id;

    if (!eventId) {
      return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
    }

    const eventRecord = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    if (!eventRecord) {
      return errorResponse('NOT_FOUND', 'Jadwal kajian tidak ditemukan.', 404, ctx.requestId);
    }

    const bazaar = await db.query.bazaarEvents.findFirst({
      where: eq(bazaarEvents.eventId, eventId),
      with: {
        booths: {
          orderBy: [asc(bazaarBooths.zone), asc(bazaarBooths.code)],
        },
      },
    });

    if (!bazaar) {
      return errorResponse('NOT_FOUND', 'Bazar belum dibuka untuk kajian ini.', 404, ctx.requestId);
    }

    // Public sanitized booths
    const sanitizedBooths = bazaar.booths.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      zone: b.zone,
      size: b.size,
      facilities: b.facilities,
      priceRupiah: b.priceRupiah,
      allowedCategory: b.allowedCategory,
      status: b.status,
      positionX: b.positionX,
      positionY: b.positionY,
    }));

    return successResponse(
      {
        event: {
          id: eventRecord.id,
          title: eventRecord.title,
          startAt: eventRecord.startAt,
          endAt: eventRecord.endAt,
          speaker: eventRecord.speaker,
          locationName: eventRecord.locationName,
        },
        bazaar: {
          id: bazaar.id,
          title: bazaar.title,
          description: bazaar.description,
          isOpen: bazaar.isOpen,
          rulesAndTerms: bazaar.rulesAndTerms,
          defaultFeeRupiah: bazaar.defaultFeeRupiah,
          bankName: bazaar.bankName,
          bankAccountNumber: bazaar.bankAccountNumber,
          bankAccountName: bazaar.bankAccountName,
          paymentInstructions: bazaar.paymentInstructions,
          layoutZones: bazaar.layoutZones,
          booths: sanitizedBooths,
        },
      },
      { requestId: ctx.requestId }
    );
  });

  // ========================================================
  // 11. POST /api/public/events/:id/bazaar/register (Public Tenant Registration)
  // ========================================================
  router.post(
    '/api/public/events/:id/bazaar/register',
    validateBody(publicTenantRegisterSchema, async (ctx, body) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const eventId = ctx.params?.id;

      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      }

      const bazaar = await db.query.bazaarEvents.findFirst({
        where: eq(bazaarEvents.eventId, eventId),
      });

      if (!bazaar || !bazaar.isOpen) {
        return errorResponse('FORBIDDEN', 'Pendaftaran bazar untuk kajian ini sedang ditutup.', 403, ctx.requestId);
      }

      // 1. Verify booth if selected
      let targetBooth: any = null;
      if (body.boothId) {
        targetBooth = await db.query.bazaarBooths.findFirst({
          where: and(eq(bazaarBooths.id, body.boothId), eq(bazaarBooths.bazaarId, bazaar.id)),
        });

        if (!targetBooth) {
          return errorResponse('NOT_FOUND', 'Slot booth yang dipilih tidak ditemukan.', 404, ctx.requestId);
        }

        if (targetBooth.status !== 'available') {
          return errorResponse(
            'CONFLICT',
            `Slot booth ${targetBooth.code} sudah dipesan atau tidak tersedia. Silakan pilih slot lain.`,
            409,
            ctx.requestId
          );
        }
      }

      // 2. Normalise Phone & Link with CRM Person
      const cleanPhone = normalizeIndonesianPhone(body.picPhone);
      let personRecord = await db.query.persons.findFirst({
        where: eq(persons.phoneE164, cleanPhone),
      });

      if (!personRecord) {
        const [createdPerson] = await db
          .insert(persons)
          .values({
            fullName: body.picName.trim(),
            phoneE164: cleanPhone,
            email: body.picEmail ? body.picEmail.trim().toLowerCase() : null,
            engagementStatus: 'aktif',
          })
          .returning();
        personRecord = createdPerson;
      }

      if (!personRecord) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memproses data pemohon tenant.', 500, ctx.requestId);
      }

      const calculatedFee = targetBooth ? targetBooth.priceRupiah : bazaar.defaultFeeRupiah;
      const infaqAmount = body.infaqAmountRupiah && body.infaqAmountRupiah > 0 ? body.infaqAmountRupiah : calculatedFee;

      // 3. Create Tenant Registration
      const [newTenant] = await db
        .insert(bazaarTenants)
        .values({
          bazaarId: bazaar.id,
          boothId: body.boothId || null,
          personId: personRecord.id,
          brandName: body.brandName.trim(),
          businessCategory: body.businessCategory,
          picName: body.picName.trim(),
          picPhone: cleanPhone,
          picEmail: body.picEmail ? body.picEmail.trim().toLowerCase() : null,
          picKtpNumber: body.picKtpNumber ? body.picKtpNumber.trim() : null,
          socialMedia: body.socialMedia ? body.socialMedia.trim() : null,
          productDescription: body.productDescription.trim(),
          electricityNeeded: body.electricityNeeded,
          electricityWatts: body.electricityWatts || 0,
          specialRequests: body.specialRequests || null,
          status: 'pending_review',
          infaqAmountRupiah: infaqAmount,
          paymentProofUrl: body.paymentProofUrl || null,
        })
        .returning();

      if (!newTenant) {
        return errorResponse('INTERNAL_ERROR', 'Gagal menyimpan data pendaftaran tenant.', 500, ctx.requestId);
      }

      // 4. Reserve Booth Slot immediately (War Tempat Lock)
      if (body.boothId) {
        await db
          .update(bazaarBooths)
          .set({ status: 'reserved', updatedAt: new Date() })
          .where(eq(bazaarBooths.id, body.boothId));
      }

      return successResponse(
        {
          tenantId: newTenant.id,
          brandName: newTenant.brandName,
          status: newTenant.status,
          boothCode: targetBooth ? targetBooth.code : null,
          boothName: targetBooth ? targetBooth.name : null,
          infaqAmountRupiah: newTenant.infaqAmountRupiah,
          registeredAt: newTenant.registeredAt,
        },
        { requestId: ctx.requestId }
      );
    })
  );
}
