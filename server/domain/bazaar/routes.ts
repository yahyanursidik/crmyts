import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  events,
  bazaarEvents,
  bazaarBooths,
  bazaarTenants,
  bazaarApplications,
  bazaarSurveys,
  bazaarIncidents,
  bazaarEvaluations,
  persons,
} from '../../db/schema';
import { eq, and, desc, asc, sql, ilike, or } from 'drizzle-orm';
import { normalizeIndonesianPhone } from '../../lib/phone';

let bazaarTablesInitialized = false;

export async function ensureBazaarTablesExist(db: any) {
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
          registration_deadline timestamp with time zone,
          payment_deadline timestamp with time zone,
          survey_deadline timestamp with time zone,
          survey_enabled boolean DEFAULT true NOT NULL,
          layout_zones jsonb,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bazaar_tenants (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
          brand_name text NOT NULL,
          business_category text DEFAULT 'kuliner' NOT NULL,
          pic_name text NOT NULL,
          pic_phone text NOT NULL,
          pic_email text,
          pic_ktp_number text,
          instagram text,
          address text,
          product_description text,
          catalog_urls jsonb,
          internal_tags jsonb DEFAULT '[]'::jsonb,
          internal_flag text DEFAULT 'normal' NOT NULL,
          internal_notes text,
          is_legacy_data boolean DEFAULT false NOT NULL,
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
          reserved_reason text,
          reserved_for_partner_name text,
          reserved_by uuid REFERENCES app_users(id),
          position_x integer DEFAULT 0,
          position_y integer DEFAULT 0,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bazaar_applications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          bazaar_id uuid NOT NULL REFERENCES bazaar_events(id) ON DELETE CASCADE,
          tenant_id uuid NOT NULL REFERENCES bazaar_tenants(id) ON DELETE CASCADE,
          assigned_booth_id uuid REFERENCES bazaar_booths(id) ON DELETE SET NULL,
          status text DEFAULT 'submitted' NOT NULL,
          electricity_needed boolean DEFAULT false NOT NULL,
          electricity_watts integer DEFAULT 0,
          special_requests text,
          booth_preferences text,
          infaq_amount_rupiah integer DEFAULT 0 NOT NULL,
          payment_proof_url text,
          payment_verified_at timestamp with time zone,
          payment_verified_by uuid REFERENCES app_users(id),
          payment_notes text,
          placement_reason text,
          placement_notes text,
          assigned_by uuid REFERENCES app_users(id),
          assigned_at timestamp with time zone,
          is_published boolean DEFAULT false NOT NULL,
          rejection_reason text,
          admin_notes text,
          checked_in_at timestamp with time zone,
          checked_in_by uuid REFERENCES app_users(id),
          registered_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bazaar_surveys (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          application_id uuid NOT NULL REFERENCES bazaar_applications(id) ON DELETE CASCADE,
          tenant_id uuid NOT NULL REFERENCES bazaar_tenants(id) ON DELETE CASCADE,
          event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          satisfaction_overall integer NOT NULL,
          satisfaction_location integer NOT NULL,
          satisfaction_facilities integer NOT NULL,
          satisfaction_communication integer NOT NULL,
          satisfaction_traffic integer NOT NULL,
          omzet_range text NOT NULL,
          feedback text,
          willing_to_join_next boolean DEFAULT true NOT NULL,
          submitted_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bazaar_incidents (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          application_id uuid NOT NULL REFERENCES bazaar_applications(id) ON DELETE CASCADE,
          tenant_id uuid NOT NULL REFERENCES bazaar_tenants(id) ON DELETE CASCADE,
          event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          type text DEFAULT 'negative' NOT NULL,
          category text NOT NULL,
          severity text DEFAULT 'minor' NOT NULL,
          description text NOT NULL,
          photo_url text,
          recorded_by uuid NOT NULL REFERENCES app_users(id),
          recorded_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bazaar_evaluations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          application_id uuid NOT NULL REFERENCES bazaar_applications(id) ON DELETE CASCADE,
          tenant_id uuid NOT NULL REFERENCES bazaar_tenants(id) ON DELETE CASCADE,
          event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          sharia_compliance_score integer DEFAULT 5 NOT NULL,
          cooperation_score integer DEFAULT 5 NOT NULL,
          cleanliness_score integer DEFAULT 5 NOT NULL,
          traffic_disruption_risk integer DEFAULT 1 NOT NULL,
          recommend_next_event boolean DEFAULT true NOT NULL,
          suggested_flag text DEFAULT 'normal' NOT NULL,
          internal_notes text,
          evaluated_by uuid NOT NULL REFERENCES app_users(id),
          evaluated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        -- Ensure columns exist in already-created tables (safe schema evolution):
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS registration_deadline timestamp with time zone;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS payment_deadline timestamp with time zone;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS survey_deadline timestamp with time zone;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS survey_enabled boolean DEFAULT true NOT NULL;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS layout_zones jsonb;

        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;

        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES persons(id) ON DELETE SET NULL;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS pic_email text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS pic_ktp_number text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS instagram text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS address text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS product_description text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS catalog_urls jsonb;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS internal_tags jsonb DEFAULT '[]'::jsonb;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS internal_flag text DEFAULT 'normal' NOT NULL;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS internal_notes text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS is_legacy_data boolean DEFAULT false NOT NULL;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;

        ALTER TABLE bazaar_booths ADD COLUMN IF NOT EXISTS reserved_reason text;
        ALTER TABLE bazaar_booths ADD COLUMN IF NOT EXISTS reserved_for_partner_name text;
        ALTER TABLE bazaar_booths ADD COLUMN IF NOT EXISTS reserved_by uuid REFERENCES app_users(id);
        ALTER TABLE bazaar_booths ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
        ALTER TABLE bazaar_booths ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;

        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS placement_reason text;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS placement_notes text;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES app_users(id);
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false NOT NULL;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS rejection_reason text;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS admin_notes text;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS payment_notes text;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES app_users(id);
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS registered_at timestamp with time zone DEFAULT now() NOT NULL;
        ALTER TABLE bazaar_applications ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
      `);
    }
    bazaarTablesInitialized = true;
  } catch (err) {
    console.error('ensureBazaarTablesExist error:', err);
  }
}

// Schemas
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
  registrationDeadline: z.string().optional().nullable(),
  paymentDeadline: z.string().optional().nullable(),
  surveyDeadline: z.string().optional().nullable(),
  surveyEnabled: z.boolean().default(true),
  layoutZones: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        color: z.string().optional(),
      })
    )
    .optional()
    .nullable(),
});

const bulkCreateBoothsSchema = z.object({
  booths: z
    .array(
      z.object({
        code: z.string().min(1, 'Kode booth diperlukan'),
        name: z.string().min(1, 'Nama booth diperlukan'),
        zone: z.string().default('Zona Utama'),
        size: z.string().default('2x2 meter'),
        facilities: z.array(z.string()).default([]),
        priceRupiah: z.number().int().min(0).default(0),
        allowedCategory: z.string().default('all'),
        positionX: z.number().int().default(0),
        positionY: z.number().int().default(0),
      })
    )
    .min(1, 'Minimal 1 booth'),
});

const updateBoothSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  zone: z.string().optional(),
  size: z.string().optional(),
  facilities: z.array(z.string()).optional(),
  priceRupiah: z.number().int().min(0).optional(),
  allowedCategory: z.string().optional(),
  status: z.enum(['available', 'assigned', 'reserved', 'blocked']).optional(),
  reservedReason: z.string().optional().nullable(),
  reservedForPartnerName: z.string().optional().nullable(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
});

const updateApplicationStatusSchema = z.object({
  status: z.enum([
    'draft',
    'submitted',
    'under_review',
    'accepted',
    'waitlist',
    'rejected',
    'payment_pending',
    'payment_verification',
    'payment_verified',
    'booth_assigned',
    'checked_in',
    'completed',
    'cancelled',
  ]),
  rejectionReason: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
  infaqAmountRupiah: z.number().int().min(0).optional(),
  paymentNotes: z.string().optional().nullable(),
});

const assignBoothSchema = z.object({
  boothId: z.string().uuid().nullable(),
  placementReason: z
    .enum(['category_isolation', 'traffic_management', 'power_access', 'equity_rotation', 'partner_reserved', 'custom'])
    .optional(),
  placementNotes: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

const recordIncidentSchema = z.object({
  applicationId: z.string().uuid(),
  type: z.enum(['negative', 'positive']).default('negative'),
  category: z.string().min(2, 'Kategori kejadian diperlukan'),
  severity: z.enum(['minor', 'moderate', 'major']).default('minor'),
  description: z.string().min(3, 'Deskripsi kejadian diperlukan'),
  photoUrl: z.string().optional().nullable(),
});

const staffEvaluationSchema = z.object({
  applicationId: z.string().uuid(),
  shariaComplianceScore: z.number().int().min(1).max(5).default(5),
  cooperationScore: z.number().int().min(1).max(5).default(5),
  cleanlinessScore: z.number().int().min(1).max(5).default(5),
  trafficDisruptionRisk: z.number().int().min(1).max(5).default(1),
  recommendNextEvent: z.boolean().default(true),
  suggestedFlag: z.enum(['normal', 'review_next_event', 'do_not_auto_accept']).default('normal'),
  internalNotes: z.string().optional().nullable(),
});

const publicApplySchema = z.object({
  brandName: z.string().min(2, 'Nama brand/usaha minimal 2 karakter'),
  businessCategory: z.string().min(2, 'Kategori usaha diperlukan'),
  picName: z.string().min(2, 'Nama penanggung jawab diperlukan'),
  picPhone: z.string().min(8, 'Nomor WhatsApp tidak valid'),
  picEmail: z.string().email('Format email tidak valid').optional().nullable().or(z.literal('')),
  picKtpNumber: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  productDescription: z.string().min(3, 'Deskripsi produk diperlukan'),
  catalogUrl: z.string().optional().nullable(),
  electricityNeeded: z.boolean().default(false),
  electricityWatts: z.number().int().min(0).default(0),
  specialRequests: z.string().optional().nullable(),
  boothPreferences: z.string().optional().nullable(),
  paymentProofUrl: z.string().optional().nullable(),
  infaqAmountRupiah: z.number().int().min(0).default(0),
});

const publicSurveySchema = z.object({
  applicationId: z.string().uuid(),
  satisfactionOverall: z.number().int().min(1).max(5),
  satisfactionLocation: z.number().int().min(1).max(5),
  satisfactionFacilities: z.number().int().min(1).max(5),
  satisfactionCommunication: z.number().int().min(1).max(5),
  satisfactionTraffic: z.number().int().min(1).max(5),
  omzetRange: z.enum(['<1m', '1-2m', '2-5m', '5-10m', '>10m']),
  feedback: z.string().optional().nullable(),
  willingToJoinNext: z.boolean().default(true),
});

export function registerBazaarRoutes(router: Router) {
  // 1. GET /api/events/:id/bazaar
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
          applications: {
            orderBy: [desc(bazaarApplications.registeredAt)],
            with: {
              tenant: true,
              assignedBooth: true,
              survey: true,
              evaluation: true,
              verifiedBy: {
                columns: { id: true, fullName: true, email: true },
              },
            },
          },
        },
      });

      return successResponse(
        {
          event: eventRecord,
          bazaar: bazaar || null,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 2. POST /api/events/:id/bazaar
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
            registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : null,
            paymentDeadline: body.paymentDeadline ? new Date(body.paymentDeadline) : null,
            surveyDeadline: body.surveyDeadline ? new Date(body.surveyDeadline) : null,
            surveyEnabled: body.surveyEnabled ?? true,
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

  // 3. PUT /api/events/:id/bazaar
  router.put(
    '/api/events/:id/bazaar',
    requireAuth(
      validateBody(createBazaarSchema.partial(), async (ctx, body) => {
        const db = getDb();
        await ensureBazaarTablesExist(db);
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
            registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : existing.registrationDeadline,
            paymentDeadline: body.paymentDeadline ? new Date(body.paymentDeadline) : existing.paymentDeadline,
            surveyDeadline: body.surveyDeadline ? new Date(body.surveyDeadline) : existing.surveyDeadline,
            updatedAt: new Date(),
          })
          .where(eq(bazaarEvents.id, existing.id))
          .returning();

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // 4. BOOTH MANAGEMENT
  router.post(
    '/api/events/:id/bazaar/booths/bulk',
    requireAuth(
      validateBody(bulkCreateBoothsSchema, async (ctx, body) => {
        const db = getDb();
        await ensureBazaarTablesExist(db);
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

        const boothRows = body.booths.map((b) => ({
          bazaarId: bazaar.id,
          code: b.code.toUpperCase().trim(),
          name: b.name,
          zone: b.zone || 'Zona Utama',
          size: b.size || '2x2 meter',
          facilities: b.facilities || [],
          priceRupiah: b.priceRupiah ?? bazaar.defaultFeeRupiah,
          allowedCategory: b.allowedCategory || 'all',
          status: 'available',
          positionX: b.positionX || 0,
          positionY: b.positionY || 0,
        }));

        const inserted = await db.insert(bazaarBooths).values(boothRows).returning();
        return successResponse(inserted, { requestId: ctx.requestId, total: inserted.length });
      })
    )
  );

  router.put(
    '/api/events/:id/bazaar/booths/:boothId',
    requireAuth(
      validateBody(updateBoothSchema, async (ctx, body) => {
        const db = getDb();
        const boothId = ctx.params?.boothId;
        if (!boothId) {
          return errorResponse('VALIDATION_ERROR', 'Booth ID diperlukan.', 400, ctx.requestId);
        }

        const existing = await db.query.bazaarBooths.findFirst({
          where: eq(bazaarBooths.id, boothId),
        });

        if (!existing) {
          return errorResponse('NOT_FOUND', 'Slot booth tidak ditemukan.', 404, ctx.requestId);
        }

        const [updated] = await db
          .update(bazaarBooths)
          .set({
            ...body,
            reservedBy: body.status === 'reserved' ? (ctx.user?.id || null) : existing.reservedBy,
            updatedAt: new Date(),
          })
          .where(eq(bazaarBooths.id, boothId))
          .returning();

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

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

  // 5. MASTER TENANT CRM
  router.get(
    '/api/bazaar/tenants',
    requireAuth(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);

      const q = ctx.query?.q?.toLowerCase()?.trim();
      const category = ctx.query?.category;
      const flag = ctx.query?.flag;

      const masterTenants = await db.query.bazaarTenants.findMany({
        orderBy: [desc(bazaarTenants.createdAt)],
        with: {
          person: true,
          applications: {
            with: {
              bazaar: { with: { event: true } },
              assignedBooth: true,
              survey: true,
              evaluation: true,
            },
          },
          incidents: true,
          evaluations: true,
        },
      });

      let filtered = masterTenants;
      if (q) {
        filtered = filtered.filter(
          (t) =>
            t.brandName.toLowerCase().includes(q) ||
            t.picName.toLowerCase().includes(q) ||
            t.picPhone.includes(q) ||
            (t.instagram && t.instagram.toLowerCase().includes(q))
        );
      }
      if (category && category !== 'all') {
        filtered = filtered.filter((t) => t.businessCategory === category);
      }
      if (flag && flag !== 'all') {
        filtered = filtered.filter((t) => t.internalFlag === flag);
      }

      return successResponse(filtered, { requestId: ctx.requestId, total: filtered.length });
    })
  );

  router.get(
    '/api/bazaar/tenants/:tenantId',
    requireAuth(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const tenantId = ctx.params?.tenantId;
      if (!tenantId) {
        return errorResponse('VALIDATION_ERROR', 'Tenant ID diperlukan.', 400, ctx.requestId);
      }

      const tenant = await db.query.bazaarTenants.findFirst({
        where: eq(bazaarTenants.id, tenantId),
        with: {
          person: true,
          applications: {
            orderBy: [desc(bazaarApplications.registeredAt)],
            with: {
              bazaar: { with: { event: true } },
              assignedBooth: true,
              survey: true,
              evaluation: true,
            },
          },
          incidents: {
            orderBy: [desc(bazaarIncidents.recordedAt)],
            with: { recorder: { columns: { id: true, fullName: true } } },
          },
          evaluations: {
            orderBy: [desc(bazaarEvaluations.evaluatedAt)],
            with: { evaluator: { columns: { id: true, fullName: true } } },
          },
        },
      });

      if (!tenant) {
        return errorResponse('NOT_FOUND', 'Profil tenant tidak ditemukan.', 404, ctx.requestId);
      }

      return successResponse(tenant, { requestId: ctx.requestId });
    })
  );

  router.put(
    '/api/bazaar/tenants/:tenantId',
    requireAuth(async (ctx) => {
      const db = getDb();
      const tenantId = ctx.params?.tenantId;
      if (!tenantId) {
        return errorResponse('VALIDATION_ERROR', 'Tenant ID diperlukan.', 400, ctx.requestId);
      }
      const body = (ctx.body as any) || {};

      const existing = await db.query.bazaarTenants.findFirst({
        where: eq(bazaarTenants.id, tenantId),
      });

      if (!existing) {
        return errorResponse('NOT_FOUND', 'Profil tenant tidak ditemukan.', 404, ctx.requestId);
      }

      const [updated] = await db
        .update(bazaarTenants)
        .set({
          brandName: body.brandName ?? existing.brandName,
          picName: body.picName ?? existing.picName,
          picPhone: body.picPhone ? normalizeIndonesianPhone(body.picPhone) : existing.picPhone,
          picEmail: body.picEmail ?? existing.picEmail,
          picKtpNumber: body.picKtpNumber ?? existing.picKtpNumber,
          instagram: body.instagram ?? existing.instagram,
          address: body.address ?? existing.address,
          businessCategory: body.businessCategory ?? existing.businessCategory,
          productDescription: body.productDescription ?? existing.productDescription,
          internalTags: body.internalTags ?? existing.internalTags,
          internalFlag: body.internalFlag ?? existing.internalFlag,
          internalNotes: body.internalNotes ?? existing.internalNotes,
          updatedAt: new Date(),
        })
        .where(eq(bazaarTenants.id, tenantId))
        .returning();

      return successResponse(updated, { requestId: ctx.requestId });
    })
  );

  // Legacy Data Import Endpoint
  router.post(
    '/api/bazaar/tenants/import-legacy',
    requireAuth(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const rows = (ctx.body as any)?.rows || [];

      let imported = 0;
      let merged = 0;

      for (const r of rows) {
        if (!r.brandName || !r.picPhone) continue;
        const normalizedPhone = normalizeIndonesianPhone(r.picPhone);

        // Deduplication check: Phone OR Brand
        const existing = await db.query.bazaarTenants.findFirst({
          where: or(eq(bazaarTenants.picPhone, normalizedPhone), ilike(bazaarTenants.brandName, r.brandName.trim())),
        });

        if (existing) {
          const currentTags = existing.internalTags || [];
          if (!currentTags.includes('Repeat Tenant')) {
            currentTags.push('Repeat Tenant');
          }
          await db
            .update(bazaarTenants)
            .set({
              internalTags: currentTags,
              instagram: existing.instagram || r.instagram,
              address: existing.address || r.address,
              productDescription: existing.productDescription || r.productDescription,
              updatedAt: new Date(),
            })
            .where(eq(bazaarTenants.id, existing.id));
          merged++;
        } else {
          await db.insert(bazaarTenants).values({
            brandName: r.brandName.trim(),
            businessCategory: r.businessCategory || 'kuliner',
            picName: r.picName || 'PIC Tenant',
            picPhone: normalizedPhone,
            picEmail: r.picEmail || null,
            instagram: r.instagram || null,
            address: r.address || null,
            productDescription: r.productDescription || null,
            internalTags: ['Legacy Tenant', 'Event Sebelumnya'],
            internalFlag: 'normal',
            isLegacyData: true,
          });
          imported++;
        }
      }

      return successResponse(
        { imported, merged, totalProcessed: rows.length },
        { requestId: ctx.requestId }
      );
    })
  );

  // 6. APPLICATIONS & SELECTION LIFECYCLE
  router.get(
    '/api/events/:id/bazaar/applications',
    requireAuth(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const eventId = ctx.params?.id;
      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      }

      const bazaar = await db.query.bazaarEvents.findFirst({
        where: eq(bazaarEvents.eventId, eventId),
      });

      if (!bazaar) {
        return successResponse([], { requestId: ctx.requestId, total: 0 });
      }

      const apps = await db.query.bazaarApplications.findMany({
        where: eq(bazaarApplications.bazaarId, bazaar.id),
        orderBy: [desc(bazaarApplications.registeredAt)],
        with: {
          tenant: {
            with: {
              applications: true,
              incidents: true,
              evaluations: true,
            },
          },
          assignedBooth: true,
          survey: true,
          evaluation: true,
          verifiedBy: { columns: { id: true, fullName: true, email: true } },
          assignedByUser: { columns: { id: true, fullName: true } },
        },
      });

      return successResponse(apps, { requestId: ctx.requestId, total: apps.length });
    })
  );

  router.put(
    '/api/events/:id/bazaar/applications/:appId/status',
    requireAuth(
      validateBody(updateApplicationStatusSchema, async (ctx, body) => {
        const db = getDb();
        const appId = ctx.params?.appId;
        if (!appId) {
          return errorResponse('VALIDATION_ERROR', 'App ID diperlukan.', 400, ctx.requestId);
        }

        const existing = await db.query.bazaarApplications.findFirst({
          where: eq(bazaarApplications.id, appId),
        });

        if (!existing) {
          return errorResponse('NOT_FOUND', 'Pendaftaran tidak ditemukan.', 404, ctx.requestId);
        }

        const isVerified = body.status === 'payment_verified';
        const [updated] = await db
          .update(bazaarApplications)
          .set({
            status: body.status,
            rejectionReason: body.rejectionReason ?? existing.rejectionReason,
            adminNotes: body.adminNotes ?? existing.adminNotes,
            paymentNotes: body.paymentNotes ?? existing.paymentNotes,
            infaqAmountRupiah: body.infaqAmountRupiah ?? existing.infaqAmountRupiah,
            paymentVerifiedAt: isVerified ? new Date() : existing.paymentVerifiedAt,
            paymentVerifiedBy: isVerified ? (ctx.user?.id || '00000000-0000-0000-0000-000000000000') : existing.paymentVerifiedBy,
            updatedAt: new Date(),
          })
          .where(eq(bazaarApplications.id, appId))
          .returning();

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // Manual Booth Assignment by Admin (with Smart Collision Checks)
  router.put(
    '/api/events/:id/bazaar/applications/:appId/assign-booth',
    requireAuth(
      validateBody(assignBoothSchema, async (ctx, body) => {
        const db = getDb();
        const appId = ctx.params?.appId;
        if (!appId) {
          return errorResponse('VALIDATION_ERROR', 'App ID diperlukan.', 400, ctx.requestId);
        }

        const application = await db.query.bazaarApplications.findFirst({
          where: eq(bazaarApplications.id, appId),
          with: { tenant: true, bazaar: true },
        });

        if (!application) {
          return errorResponse('NOT_FOUND', 'Pendaftaran tidak ditemukan.', 404, ctx.requestId);
        }

        // If removing assignment
        if (!body.boothId) {
          if (application.assignedBoothId) {
            await db
              .update(bazaarBooths)
              .set({ status: 'available' })
              .where(eq(bazaarBooths.id, application.assignedBoothId));
          }
          const [unassigned] = await db
            .update(bazaarApplications)
            .set({
              assignedBoothId: null,
              placementReason: null,
              placementNotes: null,
              assignedBy: null,
              assignedAt: null,
              status: application.status === 'booth_assigned' ? 'payment_verified' : application.status,
              updatedAt: new Date(),
            })
            .where(eq(bazaarApplications.id, appId))
            .returning();

          return successResponse(unassigned, { requestId: ctx.requestId });
        }

        // Verify target booth
        const targetBooth = await db.query.bazaarBooths.findFirst({
          where: and(eq(bazaarBooths.id, body.boothId), eq(bazaarBooths.bazaarId, application.bazaarId)),
        });

        if (!targetBooth) {
          return errorResponse('NOT_FOUND', 'Slot booth tidak ditemukan.', 404, ctx.requestId);
        }

        // Smart warnings check: Check other applications in the same zone for same category
        const zoneApps = await db.query.bazaarApplications.findMany({
          where: and(
            eq(bazaarApplications.bazaarId, application.bazaarId),
            sql`${bazaarApplications.assignedBoothId} IS NOT NULL`,
            sql`${bazaarApplications.id} != ${appId}`
          ),
          with: { tenant: true, assignedBooth: true },
        });

        const sameCategoryInZone = zoneApps.filter(
          (za) =>
            za.assignedBooth?.zone === targetBooth.zone &&
            za.tenant?.businessCategory === application.tenant?.businessCategory
        );

        let smartWarning: string | null = null;
        if (sameCategoryInZone.length > 0) {
          smartWarning = `Perhatian: Terdapat ${sameCategoryInZone.length} booth berkategori '${application.tenant?.businessCategory}' di zona '${targetBooth.zone}' (${sameCategoryInZone.map((z) => z.assignedBooth?.code).join(', ')}).`;
        }

        // Free previous booth if any
        if (application.assignedBoothId && application.assignedBoothId !== body.boothId) {
          await db
            .update(bazaarBooths)
            .set({ status: 'available' })
            .where(eq(bazaarBooths.id, application.assignedBoothId));
        }

        // Update target booth status
        await db
          .update(bazaarBooths)
          .set({ status: 'assigned', updatedAt: new Date() })
          .where(eq(bazaarBooths.id, body.boothId));

        // Update application
        const [assigned] = await db
          .update(bazaarApplications)
          .set({
            assignedBoothId: body.boothId,
            placementReason: body.placementReason || 'custom',
            placementNotes: body.placementNotes || null,
            assignedBy: ctx.user?.id || '00000000-0000-0000-0000-000000000000',
            assignedAt: new Date(),
            status: 'booth_assigned',
            isPublished: body.isPublished ?? application.isPublished,
            updatedAt: new Date(),
          })
          .where(eq(bazaarApplications.id, appId))
          .returning();

        return successResponse(
          { ...assigned, smartWarning },
          { requestId: ctx.requestId, message: smartWarning || 'Booth berhasil ditetapkan' }
        );
      })
    )
  );

  // Toggle publish booth layout to tenants
  router.put(
    '/api/events/:id/bazaar/publish-layout',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params?.id;
      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      }
      const isPublished = (ctx.body as any)?.isPublished ?? true;

      const bazaar = await db.query.bazaarEvents.findFirst({
        where: eq(bazaarEvents.eventId, eventId),
      });

      if (!bazaar) {
        return errorResponse('NOT_FOUND', 'Bazar tidak ditemukan.', 404, ctx.requestId);
      }

      await db
        .update(bazaarApplications)
        .set({ isPublished: !!isPublished, updatedAt: new Date() })
        .where(eq(bazaarApplications.bazaarId, bazaar.id));

      return successResponse(
        { isPublished: !!isPublished },
        { requestId: ctx.requestId, message: isPublished ? 'Layout booth berhasil dipublikasikan ke tenant!' : 'Layout booth disembunyikan.' }
      );
    })
  );

  // 7. ON-DAY OPERATIONS
  router.post(
    '/api/events/:id/bazaar/check-in',
    requireAuth(async (ctx) => {
      const db = getDb();
      const applicationId = (ctx.body as any)?.applicationId;

      if (!applicationId) {
        return errorResponse('VALIDATION_ERROR', 'Application ID diperlukan.', 400, ctx.requestId);
      }

      const [checkedIn] = await db
        .update(bazaarApplications)
        .set({
          status: 'checked_in',
          checkedInAt: new Date(),
          checkedInBy: ctx.user?.id || '00000000-0000-0000-0000-000000000000',
          updatedAt: new Date(),
        })
        .where(eq(bazaarApplications.id, applicationId))
        .returning();

      return successResponse(checkedIn, { requestId: ctx.requestId, message: 'Tenant berhasil check-in kehadiran!' });
    })
  );

  router.get(
    '/api/events/:id/bazaar/incidents',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params?.id;
      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      }

      const incidentList = await db.query.bazaarIncidents.findMany({
        where: eq(bazaarIncidents.eventId, eventId),
        orderBy: [desc(bazaarIncidents.recordedAt)],
        with: {
          recorder: { columns: { id: true, fullName: true } },
          tenant: true,
          application: { with: { assignedBooth: true } },
        },
      });

      return successResponse(incidentList, { requestId: ctx.requestId, total: incidentList.length });
    })
  );

  router.post(
    '/api/events/:id/bazaar/incidents',
    requireAuth(
      validateBody(recordIncidentSchema, async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params?.id;
        if (!eventId) {
          return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
        }

        const application = await db.query.bazaarApplications.findFirst({
          where: eq(bazaarApplications.id, body.applicationId),
        });

        if (!application) {
          return errorResponse('NOT_FOUND', 'Pendaftaran tenant tidak ditemukan.', 404, ctx.requestId);
        }

        const [created] = await db
          .insert(bazaarIncidents)
          .values({
            applicationId: body.applicationId,
            tenantId: application.tenantId,
            eventId,
            type: body.type,
            category: body.category,
            severity: body.severity,
            description: body.description,
            photoUrl: body.photoUrl || null,
            recordedBy: ctx.user?.id || '00000000-0000-0000-0000-000000000000',
          })
          .returning();

        return successResponse(created, { requestId: ctx.requestId, message: 'Catatan kejadian berhasil disimpan!' });
      })
    )
  );

  // 8. POST-EVENT: Surveys & Staff Evaluations
  router.get(
    '/api/events/:id/bazaar/surveys',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params?.id;
      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      }

      const surveys = await db.query.bazaarSurveys.findMany({
        where: eq(bazaarSurveys.eventId, eventId),
        orderBy: [desc(bazaarSurveys.submittedAt)],
        with: {
          tenant: true,
          application: { with: { assignedBooth: true } },
        },
      });

      // Omzet distribution stats
      const omzetCounts: Record<string, number> = {
        '<1m': 0,
        '1-2m': 0,
        '2-5m': 0,
        '5-10m': 0,
        '>10m': 0,
      };

      surveys.forEach((s) => {
        const key = s.omzetRange as string;
        if (omzetCounts[key] !== undefined) {
          omzetCounts[key]++;
        }
      });

      return successResponse(
        {
          items: surveys,
          omzetDistribution: omzetCounts,
          totalResponses: surveys.length,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  router.post(
    '/api/events/:id/bazaar/evaluations',
    requireAuth(
      validateBody(staffEvaluationSchema, async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params?.id;
        if (!eventId) {
          return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
        }

        const application = await db.query.bazaarApplications.findFirst({
          where: eq(bazaarApplications.id, body.applicationId),
        });

        if (!application) {
          return errorResponse('NOT_FOUND', 'Pendaftaran tidak ditemukan.', 404, ctx.requestId);
        }

        const existing = await db.query.bazaarEvaluations.findFirst({
          where: eq(bazaarEvaluations.applicationId, body.applicationId),
        });

        let evaluation;
        if (existing) {
          [evaluation] = await db
            .update(bazaarEvaluations)
            .set({
              shariaComplianceScore: body.shariaComplianceScore,
              cooperationScore: body.cooperationScore,
              cleanlinessScore: body.cleanlinessScore,
              trafficDisruptionRisk: body.trafficDisruptionRisk,
              recommendNextEvent: body.recommendNextEvent,
              suggestedFlag: body.suggestedFlag,
              internalNotes: body.internalNotes || null,
              evaluatedBy: ctx.user?.id || '00000000-0000-0000-0000-000000000000',
              evaluatedAt: new Date(),
            })
            .where(eq(bazaarEvaluations.id, existing.id))
            .returning();
        } else {
          [evaluation] = await db
            .insert(bazaarEvaluations)
            .values({
              applicationId: body.applicationId,
              tenantId: application.tenantId,
              eventId,
              shariaComplianceScore: body.shariaComplianceScore,
              cooperationScore: body.cooperationScore,
              cleanlinessScore: body.cleanlinessScore,
              trafficDisruptionRisk: body.trafficDisruptionRisk,
              recommendNextEvent: body.recommendNextEvent,
              suggestedFlag: body.suggestedFlag,
              internalNotes: body.internalNotes || null,
              evaluatedBy: ctx.user?.id || '00000000-0000-0000-0000-000000000000',
            })
            .returning();
        }

        if (body.suggestedFlag && body.suggestedFlag !== 'normal') {
          await db
            .update(bazaarTenants)
            .set({ internalFlag: body.suggestedFlag, updatedAt: new Date() })
            .where(eq(bazaarTenants.id, application.tenantId));
        }

        return successResponse(evaluation, { requestId: ctx.requestId, message: 'Evaluasi panitia berhasil disimpan!' });
      })
    )
  );

  // 9. PUBLIC PORTAL
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
          registrationDeadline: bazaar.registrationDeadline,
          paymentDeadline: bazaar.paymentDeadline,
          surveyEnabled: bazaar.surveyEnabled,
          layoutZones: bazaar.layoutZones,
          booths: sanitizedBooths,
        },
      },
      { requestId: ctx.requestId }
    );
  });

  // Public Tenant Application Submission
  router.post(
    '/api/public/events/:id/bazaar/apply',
    validateBody(publicApplySchema, async (ctx, body) => {
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

      if (bazaar.registrationDeadline && new Date() > new Date(bazaar.registrationDeadline)) {
        return errorResponse('FORBIDDEN', 'Batas waktu pendaftaran bazar telah berakhir.', 403, ctx.requestId);
      }

      const normalizedPhone = normalizeIndonesianPhone(body.picPhone);

      // 1. Find or create Master Tenant CRM profile
      let masterTenant = await db.query.bazaarTenants.findFirst({
        where: or(eq(bazaarTenants.picPhone, normalizedPhone), ilike(bazaarTenants.brandName, body.brandName.trim())),
      });

      if (!masterTenant) {
        let person = await db.query.persons.findFirst({
          where: eq(persons.phoneE164, normalizedPhone),
        });

        let personId: string | null = person?.id || null;
        if (!personId) {
          const [newPerson] = await db
            .insert(persons)
            .values({
              fullName: body.picName,
              phoneE164: normalizedPhone,
              email: body.picEmail || null,
            })
            .returning();
          personId = newPerson ? newPerson.id : null;
        }

        const [newTenant] = await db
          .insert(bazaarTenants)
          .values({
            personId,
            brandName: body.brandName.trim(),
            businessCategory: body.businessCategory,
            picName: body.picName,
            picPhone: normalizedPhone,
            picEmail: body.picEmail || null,
            picKtpNumber: body.picKtpNumber || null,
            instagram: body.instagram || null,
            address: body.address || null,
            productDescription: body.productDescription,
            catalogUrls: body.catalogUrl ? [body.catalogUrl] : [],
            internalTags: ['Pendaftar Baru'],
            internalFlag: 'normal',
          })
          .returning();
        masterTenant = newTenant;
      } else {
        const tags = masterTenant.internalTags || [];
        if (!tags.includes('Repeat Tenant')) tags.push('Repeat Tenant');

        await db
          .update(bazaarTenants)
          .set({
            picName: body.picName,
            picEmail: body.picEmail || masterTenant.picEmail,
            instagram: body.instagram || masterTenant.instagram,
            address: body.address || masterTenant.address,
            productDescription: body.productDescription,
            internalTags: tags,
            updatedAt: new Date(),
          })
          .where(eq(bazaarTenants.id, masterTenant.id));
      }

      if (!masterTenant) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memproses master tenant.', 500, ctx.requestId);
      }

      // 2. Check if already applied for this specific event
      const existingApp = await db.query.bazaarApplications.findFirst({
        where: and(eq(bazaarApplications.bazaarId, bazaar.id), eq(bazaarApplications.tenantId, masterTenant.id)),
      });

      if (existingApp) {
        return errorResponse('CONFLICT', 'Brand/Usaha Anda sudah terdaftar pada bazar kajian ini.', 409, ctx.requestId);
      }

      // 3. Create Application
      const hasPayment = !!body.paymentProofUrl;
      const initialStatus = hasPayment ? 'payment_verification' : 'submitted';

      const [createdApp] = await db
        .insert(bazaarApplications)
        .values({
          bazaarId: bazaar.id,
          tenantId: masterTenant.id,
          status: initialStatus,
          electricityNeeded: body.electricityNeeded,
          electricityWatts: body.electricityWatts || 0,
          specialRequests: body.specialRequests || null,
          boothPreferences: body.boothPreferences || null,
          infaqAmountRupiah: body.infaqAmountRupiah || bazaar.defaultFeeRupiah,
          paymentProofUrl: body.paymentProofUrl || null,
        })
        .returning();

      return successResponse(
        {
          application: createdApp,
          tenant: masterTenant,
          bazaarTitle: bazaar.title,
        },
        { requestId: ctx.requestId, message: 'Pendaftaran formulir tenant bazar berhasil dikirim!' }
      );
    })
  );

  // Public Survey Submission
  router.post(
    '/api/public/events/:id/bazaar/survey',
    validateBody(publicSurveySchema, async (ctx, body) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const eventId = ctx.params?.id;

      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      }

      const application = await db.query.bazaarApplications.findFirst({
        where: eq(bazaarApplications.id, body.applicationId),
      });

      if (!application) {
        return errorResponse('NOT_FOUND', 'Data pendaftaran tidak ditemukan.', 404, ctx.requestId);
      }

      const existingSurvey = await db.query.bazaarSurveys.findFirst({
        where: eq(bazaarSurveys.applicationId, body.applicationId),
      });

      if (existingSurvey) {
        return errorResponse('CONFLICT', 'Anda sudah pernah mengisi survei untuk event ini.', 409, ctx.requestId);
      }

      const [survey] = await db
        .insert(bazaarSurveys)
        .values({
          applicationId: body.applicationId,
          tenantId: application.tenantId,
          eventId,
          satisfactionOverall: body.satisfactionOverall,
          satisfactionLocation: body.satisfactionLocation,
          satisfactionFacilities: body.satisfactionFacilities,
          satisfactionCommunication: body.satisfactionCommunication,
          satisfactionTraffic: body.satisfactionTraffic,
          omzetRange: body.omzetRange,
          feedback: body.feedback || null,
          willingToJoinNext: body.willingToJoinNext,
        })
        .returning();

      await db
        .update(bazaarApplications)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(bazaarApplications.id, body.applicationId));

      return successResponse(survey, { requestId: ctx.requestId, message: 'Jazakumullahu khairan! Survei berhasil dikirim.' });
    })
  );
}
