import { z } from "zod";
import { Router } from "../../http/router";
import { requireEventAccess } from "../events/access";
import { successResponse, errorResponse } from "../../http/response";
import { getDb } from "../../db/client";
import {
  events,
  bazaarEvents,
  bazaarBooths,
  bazaarTenants,
  bazaarApplications,
  bazaarSurveys,
  bazaarIncidents,
  bazaarEvaluations,
} from "../../db/schema";
import { eq, and, desc, asc, sql, or } from "drizzle-orm";
import { type Handler, type RequestContext } from "../../http/middleware";
import { logExportEvent, logAuditEvent } from "../../audit/service";
import { recordsToCsv } from "../../lib/csv";
import { PERMISSIONS, hasPermission } from "../../permissions/constants";
import { createBazaarAccess, readBazaarAccess } from "./accessToken";
import {
  BazaarError,
  configureBazaar,
  changeApplication,
  assignBazaarBooth,
  checkInBazaar,
  mutateBooth,
  publicApplyBazaar,
  submitBazaarSurvey,
  uploadBazaarProof,
  saveBazaarTenant,
  importBazaarTenants,
  publishBazaar,
  recordBazaarIncident,
  evaluateBazaarTenant,
} from "./operations";
import {
  BAZAAR_CATEGORIES,
  BAZAAR_PLACED,
  bazaarBankConfigured,
  bazaarRegistrationOpen,
  bazaarPaymentConfirmed,
} from "../../../src/lib/bazaarPolicy";

let bazaarTablesInitialized = false;
let bazaarInitPromise: Promise<void> | null = null;

export async function ensureBazaarTablesExist(db: any) {
  if (bazaarTablesInitialized) return;
  if (!bazaarInitPromise) {
    bazaarInitPromise = (async () => {
      try {
        if (typeof db.execute === "function") {
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
          category_quotas jsonb,
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
          threads text,
          website_url text,
          logo_url text,
          google_drive_catalog_url text,
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
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS payment_enabled boolean NOT NULL DEFAULT false;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS registration_deadline timestamp with time zone;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS payment_deadline timestamp with time zone;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS survey_deadline timestamp with time zone;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS survey_enabled boolean DEFAULT true NOT NULL;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS layout_zones jsonb;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS category_quotas jsonb;

        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
        ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;

        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES persons(id) ON DELETE SET NULL;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS pic_email text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS pic_ktp_number text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS instagram text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS threads text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS website_url text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS logo_url text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS google_drive_catalog_url text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS address text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS product_description text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS catalog_urls jsonb;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS internal_tags jsonb DEFAULT '[]'::jsonb;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS internal_flag text DEFAULT 'normal' NOT NULL;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS internal_notes text;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS is_legacy_data boolean DEFAULT false NOT NULL;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
        ALTER TABLE bazaar_tenants ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;

        DO $$ 
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bazaar_tenants' AND column_name='bazaar_id') THEN
            ALTER TABLE bazaar_tenants ALTER COLUMN bazaar_id DROP NOT NULL;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bazaar_tenants' AND column_name='event_id') THEN
            ALTER TABLE bazaar_tenants ALTER COLUMN event_id DROP NOT NULL;
          END IF;
        END $$;

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
        console.error("ensureBazaarTablesExist error:", err);
        bazaarTablesInitialized = true;
      }
    })();
  }
  await bazaarInitPromise;
}

// Schemas
const createBazaarSchema = z.object({
  title: z.string().min(3, "Nama bazar minimal 3 karakter"),
  description: z.string().optional().nullable(),
  isOpen: z.boolean().default(true),
  rulesAndTerms: z.string().optional().nullable(),
  defaultFeeRupiah: z.number().int().min(0).default(0),
  paymentEnabled: z.boolean().default(false),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),
  registrationDeadline: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable(),
  paymentDeadline: z.string().datetime({ offset: true }).optional().nullable(),
  surveyDeadline: z.string().datetime({ offset: true }).optional().nullable(),
  surveyEnabled: z.boolean().default(true),
  layoutZones: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        color: z.string().optional(),
      }),
    )
    .optional()
    .nullable(),
  categoryQuotas: z
    .array(
      z.object({
        category: z.string(),
        maxQuota: z.number().int().min(0),
      }),
    )
    .optional()
    .nullable(),
});

const bulkCreateBoothsSchema = z.object({
  booths: z
    .array(
      z.object({
        code: z.string().min(1, "Kode booth diperlukan"),
        name: z.string().min(1, "Nama booth diperlukan"),
        zone: z.string().default("Zona Utama"),
        size: z.string().default("2x2 meter"),
        facilities: z.array(z.string()).default([]),
        priceRupiah: z.number().int().min(0).default(0),
        allowedCategory: z.string().default("all"),
        positionX: z.number().int().default(0),
        positionY: z.number().int().default(0),
      }),
    )
    .min(1, "Minimal 1 booth")
    .max(500, "Maksimal 500 stan per permintaan."),
});

const updateBoothSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  zone: z.string().optional(),
  size: z.string().optional(),
  facilities: z.array(z.string()).optional(),
  priceRupiah: z.number().int().min(0).optional(),
  allowedCategory: z.string().optional(),
  status: z.enum(["available", "assigned", "reserved", "blocked"]).optional(),
  reservedReason: z.string().optional().nullable(),
  reservedForPartnerName: z.string().optional().nullable(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
});

const bulkUpdateBoothPricingSchema = z.object({
  zone: z.string().optional(),
  size: z.string().optional(),
  priceRupiah: z.number().int().min(0, "Tarif infaq tidak boleh negatif"),
});

const updateApplicationStatusSchema = z.object({
  status: z.enum([
    "draft",
    "submitted",
    "under_review",
    "accepted",
    "waitlist",
    "rejected",
    "payment_pending",
    "payment_verification",
    "payment_verified",
    "booth_assigned",
    "checked_in",
    "completed",
    "cancelled",
  ]),
  rejectionReason: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
  infaqAmountRupiah: z.number().int().min(0).optional(),
  paymentNotes: z.string().optional().nullable(),
});

const updateTenantFeeSchema = z.object({
  infaqAmountRupiah: z.number().int().min(0),
  paymentNotes: z.string().optional().nullable(),
  status: z
    .enum([
      "draft",
      "submitted",
      "under_review",
      "accepted",
      "waitlist",
      "rejected",
      "payment_pending",
      "payment_verification",
      "payment_verified",
      "booth_assigned",
      "checked_in",
      "completed",
      "cancelled",
    ])
    .optional(),
});

const assignBoothSchema = z.object({
  boothId: z.string().uuid().nullable(),
  placementReason: z
    .enum([
      "category_isolation",
      "traffic_management",
      "power_access",
      "equity_rotation",
      "partner_reserved",
      "custom",
    ])
    .optional(),
  placementNotes: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
  infaqAmountRupiah: z.number().int().min(0).optional(),
  syncBoothPrice: z.boolean().optional(),
});

const recordIncidentSchema = z.object({
  applicationId: z.string().uuid(),
  type: z.enum(["negative", "positive"]).default("negative"),
  category: z.string().min(2, "Kategori kejadian diperlukan"),
  severity: z.enum(["minor", "moderate", "major"]).default("minor"),
  description: z.string().min(3, "Deskripsi kejadian diperlukan"),
  photoUrl: z.string().optional().nullable(),
});

const staffEvaluationSchema = z.object({
  applicationId: z.string().uuid(),
  shariaComplianceScore: z.number().int().min(1).max(5).default(5),
  cooperationScore: z.number().int().min(1).max(5).default(5),
  cleanlinessScore: z.number().int().min(1).max(5).default(5),
  trafficDisruptionRisk: z.number().int().min(1).max(5).default(1),
  recommendNextEvent: z.boolean().default(true),
  suggestedFlag: z
    .enum(["normal", "review_next_event", "do_not_auto_accept"])
    .default("normal"),
  internalNotes: z.string().optional().nullable(),
});

const safeLink = z
  .string()
  .trim()
  .max(1500)
  .refine(
    (value) => !value || /^https?:\/\//i.test(value),
    "Gunakan tautan http atau https.",
  )
  .optional()
  .nullable();
const proofSchema = z
  .string()
  .max(6_000_000)
  .refine(
    (value) =>
      /^https:\/\//i.test(value) ||
      /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(
        value,
      ),
    "Bukti harus berupa gambar/PDF atau tautan https.",
  );
const publicApplySchema = z.object({
  agreedToRules: z.literal(true, {
    errorMap: () => ({ message: "Setujui tata tertib sebelum mendaftar." }),
  }),
  brandName: z
    .string()
    .trim()
    .min(2, "Nama brand/usaha minimal 2 karakter")
    .max(160),
  businessCategory: z.enum(BAZAAR_CATEGORIES),
  picName: z
    .string()
    .trim()
    .min(2, "Nama penanggung jawab diperlukan")
    .max(160),
  picPhone: z.string().trim().min(8, "Nomor WhatsApp tidak valid").max(24),
  picEmail: z
    .string()
    .email("Format email tidak valid")
    .optional()
    .nullable()
    .or(z.literal("")),
  picKtpNumber: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  threads: z.string().optional().nullable(),
  websiteUrl: safeLink,
  logoUrl: safeLink,
  googleDriveCatalogUrl: safeLink,
  address: z.string().optional().nullable(),
  productDescription: z.string().min(3, "Deskripsi produk diperlukan"),
  catalogUrl: safeLink,
  electricityNeeded: z.boolean().default(false),
  electricityWatts: z.number().int().min(0).default(0),
  specialRequests: z.string().optional().nullable(),
  boothPreferences: z.string().optional().nullable(),
  paymentProofUrl: proofSchema.optional().nullable(),
  infaqAmountRupiah: z.number().int().min(0).default(0),
});

const publicSurveySchema = z.object({
  applicationId: z.string().uuid().optional().nullable(),
  phone: z.string().optional().nullable(),
  brandName: z.string().optional().nullable(),
  satisfactionOverall: z.number().int().min(1).max(5),
  satisfactionLocation: z.number().int().min(1).max(5),
  satisfactionFacilities: z.number().int().min(1).max(5),
  satisfactionCommunication: z.number().int().min(1).max(5),
  satisfactionTraffic: z.number().int().min(1).max(5),
  omzetRange: z.enum(["<1m", "1-2m", "2-5m", "5-10m", ">10m"]),
  feedback: z.string().optional().nullable(),
  willingToJoinNext: z.boolean().default(true),
});

const publicUploadProofSchema = z.object({
  applicationId: z.string().uuid("ID Pendaftaran tidak valid"),
  phone: z.string().min(8, "Nomor WhatsApp verifikasi diperlukan"),
  paymentProofUrl: proofSchema,
  paymentNotes: z.string().optional().nullable(),
});

const tenantEditSchema = publicApplySchema
  .pick({
    brandName: true,
    businessCategory: true,
    picName: true,
    picPhone: true,
    picEmail: true,
    picKtpNumber: true,
    instagram: true,
    threads: true,
    websiteUrl: true,
    logoUrl: true,
    googleDriveCatalogUrl: true,
    address: true,
    productDescription: true,
  })
  .partial()
  .extend({
    personId: z.string().uuid().nullable().optional(),
    catalogUrls: z.array(z.string().url().max(1500)).max(20).optional(),
    internalTags: z.array(z.string().trim().max(80)).max(30).optional(),
    internalFlag: z
      .enum(["normal", "review_next_event", "do_not_auto_accept"])
      .optional(),
    internalNotes: z.string().max(4000).nullable().optional(),
  });
const importTenantSchema = z.object({
  rows: z
    .array(
      publicApplySchema
        .pick({
          brandName: true,
          businessCategory: true,
          picName: true,
          picPhone: true,
          picEmail: true,
          instagram: true,
          address: true,
          productDescription: true,
        })
        .extend({
          businessCategory: z.enum(BAZAAR_CATEGORIES).default("kuliner"),
          productDescription: z.string().max(2000).optional().nullable(),
        }),
    )
    .min(1)
    .max(500),
  dryRun: z.boolean().default(false),
});
function bazaarOperation(
  schema: z.ZodTypeAny | undefined,
  operation: (ctx: RequestContext, body: any) => Promise<unknown>,
  publicRoute = false,
): Handler {
  const handler: Handler = async (ctx) => {
    for (const key of ["id", "appId", "boothId", "tenantId"])
      if (
        ctx.params[key] &&
        !z.string().uuid().safeParse(ctx.params[key]).success
      )
        return errorResponse(
          "VALIDATION_ERROR",
          "ID tidak valid.",
          400,
          ctx.requestId,
        );
    const parsed = schema?.safeParse(ctx.body);
    if (parsed && !parsed.success)
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message || "Data tidak valid.",
        400,
        ctx.requestId,
      );
    try {
      await ensureBazaarTablesExist(getDb());
      return successResponse(
        await operation(ctx, parsed?.success ? parsed.data : ctx.body || {}),
        { requestId: ctx.requestId },
      );
    } catch (error) {
      if (error instanceof BazaarError)
        return errorResponse(
          error.status === 401
            ? "UNAUTHENTICATED"
            : error.status === 403
              ? "FORBIDDEN"
              : error.status === 404
                ? "NOT_FOUND"
                : error.status === 409
                  ? "CONFLICT"
                  : "VALIDATION_ERROR",
          error.message,
          error.status,
          ctx.requestId,
        );
      const code = (error as any)?.cause?.code || (error as any)?.code;
      if (["23505", "55P03", "40P01"].includes(code))
        return errorResponse(
          "CONFLICT",
          "Data sedang diproses atau sudah digunakan. Muat ulang dan periksa hasilnya.",
          409,
          ctx.requestId,
        );
      throw error;
    }
  };
  return publicRoute ? handler : requireEventAccess(handler);
}
const actor = (ctx: RequestContext) => ({
  id: ctx.user!.id,
  requestId: ctx.requestId,
});

function applicationInEvent(
  applicationId: string,
  eventId: string,
  allowBazaarId = false,
) {
  return and(
    eq(bazaarApplications.id, applicationId),
    sql`EXISTS (SELECT 1 FROM bazaar_events b WHERE b.id = ${bazaarApplications.bazaarId} AND (b.event_id = ${eventId}::uuid OR (${allowBazaarId} AND b.id = ${eventId}::uuid)))`,
  );
}
export function registerBazaarRoutes(router: Router) {
  // 0. GET /api/bazaar/overview (Single fast query for Bazaar Hub list)
  router.get(
    "/api/bazaar/overview",
    requireEventAccess(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);

      const eventList = await db.query.events.findMany({
        orderBy: [desc(events.startAt)],
        columns: {
          id: true,
          title: true,
          speaker: true,
          startAt: true,
          endAt: true,
          locationName: true,
          status: true,
        },
      });

      const bazaarList = await db.query.bazaarEvents.findMany({
        with: {
          booths: {
            columns: {
              id: true,
              status: true,
            },
          },
          applications: {
            columns: {
              id: true,
              status: true,
              infaqAmountRupiah: true,
              paymentVerifiedAt: true,
            },
          },
        },
      });

      const bazaarMap = new Map<string, any>();
      for (const baz of bazaarList) {
        const booths = baz.booths || [];
        const apps = baz.applications || [];
        const availableBoothsCount = booths.filter(
          (b: any) => b.status === "available",
        ).length;
        const bookedBoothsCount = booths.filter(
          (b: any) => b.status === "assigned",
        ).length;
        const verifiedTenantsCount = apps.filter(bazaarPaymentConfirmed).length;
        const totalInfaqRupiah = apps
          .filter(bazaarPaymentConfirmed)
          .reduce((sum: number, a: any) => sum + (a.infaqAmountRupiah || 0), 0);

        bazaarMap.set(baz.eventId, {
          id: baz.id,
          title: baz.title,
          isOpen: baz.isOpen,
          registrationDeadline: baz.registrationDeadline,
          paymentConfigured: bazaarBankConfigured(baz),
          defaultFeeRupiah: baz.defaultFeeRupiah,
          boothsCount: booths.length,
          availableBoothsCount,
          bookedBoothsCount,
          tenantsCount: apps.length,
          verifiedTenantsCount,
          totalInfaqRupiah,
        });
      }

      const eventsWithBazaar = eventList.map((ev) => ({
        id: ev.id,
        title: ev.title,
        speaker: ev.speaker,
        startAt: ev.startAt,
        endAt: ev.endAt,
        locationName: ev.locationName,
        status: ev.status,
        bazaar: bazaarMap.get(ev.id) || null,
      }));

      return successResponse(eventsWithBazaar, {
        requestId: ctx.requestId,
        total: eventsWithBazaar.length,
      });
    }),
  );

  // 1. GET /api/events/:id/bazaar
  router.get(
    "/api/events/:id/bazaar",
    requireEventAccess(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const eventId = ctx.params?.id;

      if (!eventId) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Event ID diperlukan.",
          400,
          ctx.requestId,
        );
      }

      const eventRecord = await db.query.events.findFirst({
        where: eq(events.id, eventId),
      });

      if (!eventRecord) {
        return errorResponse(
          "NOT_FOUND",
          "Jadwal kajian tidak ditemukan.",
          404,
          ctx.requestId,
        );
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
        { requestId: ctx.requestId },
      );
    }),
  );

  // 2. POST /api/events/:id/bazaar
  router.post(
    "/api/events/:id/bazaar",
    bazaarOperation(createBazaarSchema, async (ctx, body) =>
      configureBazaar(ctx.params.id!, body, actor(ctx), true),
    ),
  );

  // 3. PUT /api/events/:id/bazaar
  router.put(
    "/api/events/:id/bazaar",
    bazaarOperation(createBazaarSchema.partial(), async (ctx, body) =>
      configureBazaar(ctx.params.id!, body, actor(ctx)),
    ),
  );

  // 4. BOOTH MANAGEMENT
  router.post(
    "/api/events/:id/bazaar/booths/bulk",
    bazaarOperation(bulkCreateBoothsSchema, async (ctx, body) =>
      mutateBooth(ctx.params.id!, undefined, body, actor(ctx), "bulk"),
    ),
  );

  router.put(
    "/api/events/:id/bazaar/booths/bulk-pricing",
    bazaarOperation(bulkUpdateBoothPricingSchema, async (ctx, body) =>
      mutateBooth(ctx.params.id!, undefined, body, actor(ctx), "pricing"),
    ),
  );

  router.put(
    "/api/events/:id/bazaar/booths/:boothId",
    bazaarOperation(updateBoothSchema, async (ctx, body) =>
      mutateBooth(
        ctx.params.id!,
        ctx.params.boothId!,
        body,
        actor(ctx),
        "update",
      ),
    ),
  );

  router.delete(
    "/api/events/:id/bazaar/booths/:boothId",
    bazaarOperation(undefined, async (ctx, body) =>
      mutateBooth(
        ctx.params.id!,
        ctx.params.boothId!,
        body,
        actor(ctx),
        "delete",
      ),
    ),
  );

  // 5. MASTER TENANT CRM
  router.get(
    "/api/bazaar/tenants",
    requireEventAccess(async (ctx) => {
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
            (t.instagram && t.instagram.toLowerCase().includes(q)),
        );
      }
      if (category && category !== "all") {
        filtered = filtered.filter((t) => t.businessCategory === category);
      }
      if (flag && flag !== "all") {
        filtered = filtered.filter((t) => t.internalFlag === flag);
      }

      const enriched = filtered.map((t) => {
        const verifiedApps = (t.applications || []).filter(
          bazaarPaymentConfirmed,
        );
        const lifetimeInfaqRupiah = verifiedApps.reduce(
          (sum: number, a: any) => sum + (a.infaqAmountRupiah || 0),
          0,
        );
        return {
          ...t,
          lifetimeInfaqRupiah,
          totalParticipations: (t.applications || []).length,
        };
      });

      return successResponse(enriched, {
        requestId: ctx.requestId,
        total: enriched.length,
      });
    }),
  );

  router.get(
    "/api/bazaar/tenants/:tenantId",
    requireEventAccess(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const tenantId = ctx.params?.tenantId;
      if (!tenantId) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Tenant ID diperlukan.",
          400,
          ctx.requestId,
        );
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
        return errorResponse(
          "NOT_FOUND",
          "Profil tenant tidak ditemukan.",
          404,
          ctx.requestId,
        );
      }

      return successResponse(tenant, { requestId: ctx.requestId });
    }),
  );

  router.put(
    "/api/bazaar/tenants/:tenantId",
    bazaarOperation(tenantEditSchema, async (ctx, body) =>
      saveBazaarTenant(ctx.params.tenantId!, body, actor(ctx)),
    ),
  );

  // Legacy Data Import Endpoint
  router.post(
    "/api/bazaar/tenants/import-legacy",
    bazaarOperation(importTenantSchema, async (ctx, body) =>
      importBazaarTenants(body.rows, actor(ctx), body.dryRun),
    ),
  );

  // 6. APPLICATIONS & SELECTION LIFECYCLE
  router.get(
    "/api/events/:id/bazaar/applications",
    requireEventAccess(async (ctx) => {
      const db = getDb();
      await ensureBazaarTablesExist(db);
      const eventId = ctx.params?.id;
      if (!eventId) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Event ID diperlukan.",
          400,
          ctx.requestId,
        );
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

      return successResponse(apps, {
        requestId: ctx.requestId,
        total: apps.length,
      });
    }),
  );

  router.put(
    "/api/events/:id/bazaar/applications/:appId/status",
    bazaarOperation(updateApplicationStatusSchema, async (ctx, body) =>
      changeApplication(ctx.params.id!, ctx.params.appId!, body, actor(ctx)),
    ),
  );

  // Update Tenant Application Fee / Infaq Setting
  router.put(
    "/api/events/:id/bazaar/applications/:appId/fee",
    bazaarOperation(updateTenantFeeSchema, async (ctx, body) =>
      changeApplication(
        ctx.params.id!,
        ctx.params.appId!,
        body,
        actor(ctx),
        true,
      ),
    ),
  );

  // Manual Booth Assignment by Admin (with Smart Collision Checks & Category Validation)
  router.put(
    "/api/events/:id/bazaar/applications/:appId/assign-booth",
    bazaarOperation(assignBoothSchema, async (ctx, body) =>
      assignBazaarBooth(ctx.params.id!, ctx.params.appId!, body, actor(ctx)),
    ),
  );

  // Toggle publish booth layout to tenants
  router.put(
    "/api/events/:id/bazaar/publish-layout",
    bazaarOperation(z.object({ isPublished: z.boolean() }), async (ctx, body) =>
      publishBazaar(ctx.params.id!, body.isPublished, actor(ctx)),
    ),
  );

  // 7. ON-DAY OPERATIONS
  router.post(
    "/api/events/:id/bazaar/check-in",
    bazaarOperation(
      z.object({ applicationId: z.string().uuid() }),
      async (ctx, body) =>
        checkInBazaar(ctx.params.id!, body.applicationId, actor(ctx)),
    ),
  );

  router.get(
    "/api/events/:id/bazaar/incidents",
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params?.id;
      if (!eventId) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Event ID diperlukan.",
          400,
          ctx.requestId,
        );
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

      return successResponse(incidentList, {
        requestId: ctx.requestId,
        total: incidentList.length,
      });
    }),
  );

  router.post(
    "/api/events/:id/bazaar/incidents",
    bazaarOperation(recordIncidentSchema, async (ctx, body) =>
      recordBazaarIncident(ctx.params.id!, body, actor(ctx)),
    ),
  );

  // 8. POST-EVENT: Surveys & Staff Evaluations
  router.get(
    "/api/events/:id/bazaar/surveys",
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params?.id;
      if (!eventId) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Event ID diperlukan.",
          400,
          ctx.requestId,
        );
      }

      const surveys = await db.query.bazaarSurveys.findMany({
        where: eq(bazaarSurveys.eventId, eventId),
        orderBy: [desc(bazaarSurveys.submittedAt)],
        with: {
          tenant: true,
          application: { with: { assignedBooth: true } },
        },
      });

      // Omzet distribution stats & Average Satisfaction
      const omzetCounts: Record<string, number> = {
        "<1m": 0,
        "1-2m": 0,
        "2-5m": 0,
        "5-10m": 0,
        ">10m": 0,
      };

      let sumOverall = 0;
      let sumLocation = 0;
      let sumFacilities = 0;
      let sumTraffic = 0;
      let sumCommunication = 0;
      let willingCount = 0;

      surveys.forEach((s) => {
        const key = s.omzetRange as string;
        if (omzetCounts[key] !== undefined) {
          omzetCounts[key]++;
        }
        sumOverall += s.satisfactionOverall || 0;
        sumLocation += s.satisfactionLocation || 0;
        sumFacilities += s.satisfactionFacilities || 0;
        sumTraffic += s.satisfactionTraffic || 0;
        sumCommunication += s.satisfactionCommunication || 0;
        if (s.willingToJoinNext) willingCount++;
      });

      const n = surveys.length || 1;
      const averages = {
        overall: surveys.length ? +(sumOverall / n).toFixed(1) : 0,
        location: surveys.length ? +(sumLocation / n).toFixed(1) : 0,
        facilities: surveys.length ? +(sumFacilities / n).toFixed(1) : 0,
        traffic: surveys.length ? +(sumTraffic / n).toFixed(1) : 0,
        communication: surveys.length ? +(sumCommunication / n).toFixed(1) : 0,
        willingPercentage: surveys.length
          ? Math.round((willingCount / surveys.length) * 100)
          : 0,
      };

      return successResponse(
        {
          items: surveys,
          omzetDistribution: omzetCounts,
          averages,
          totalResponses: surveys.length,
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  router.post(
    "/api/events/:id/bazaar/evaluations",
    bazaarOperation(staffEvaluationSchema, async (ctx, body) =>
      evaluateBazaarTenant(ctx.params.id!, body, actor(ctx)),
    ),
  );

  router.post(
    "/api/events/:id/bazaar/applications/:appId/access",
    bazaarOperation(undefined, async (ctx) => {
      const app = await getDb().query.bazaarApplications.findFirst({
        where: applicationInEvent(ctx.params.appId!, ctx.params.id!),
      });
      if (!app) throw new BazaarError("Pendaftaran tidak ditemukan.", 404);
      await logAuditEvent({
        actorUserId: ctx.user!.id,
        action: "bazaar_access_issue",
        entityType: "bazaar_application",
        entityId: app.id,
        requestId: ctx.requestId,
      });
      return {
        applicationId: app.id,
        eventId: ctx.params.id!,
        accessToken: createBazaarAccess(app.id, app.bazaarId),
      };
    }),
  );
  router.post(
    "/api/events/:id/bazaar/export",
    bazaarOperation(
      z.object({
        kind: z.enum(["applications", "surveys"]),
        ids: z.array(z.string().uuid()).max(100000),
        reason: z.string().trim().min(3).max(300),
      }),
      async (ctx, body) => {
        if (!hasPermission(ctx.user!.roles, PERMISSIONS.DATA_EXPORT))
          throw new BazaarError("Izin ekspor diperlukan.", 403);
        const bazaar = await getDb().query.bazaarEvents.findFirst({
          where: eq(bazaarEvents.eventId, ctx.params.id!),
        });
        if (!bazaar) throw new BazaarError("Bazar tidak ditemukan.", 404);
        const apps = await getDb().query.bazaarApplications.findMany({
          where: eq(bazaarApplications.bazaarId, bazaar.id),
          with: { tenant: true, assignedBooth: true, survey: true },
        });
        const selected = apps.filter((app) =>
          body.ids.includes(body.kind === "surveys" ? app.survey?.id : app.id),
        );
        const rows = selected.map((app) =>
          body.kind === "surveys"
            ? {
                Brand: app.tenant.brandName,
                PIC: app.tenant.picName,
                Stan: app.assignedBooth?.code,
                Omzet: app.survey?.omzetRange,
                Kepuasan: app.survey?.satisfactionOverall,
                Lokasi: app.survey?.satisfactionLocation,
                Fasilitas: app.survey?.satisfactionFacilities,
                Komunikasi: app.survey?.satisfactionCommunication,
                Pengunjung: app.survey?.satisfactionTraffic,
                IkutLagi: app.survey?.willingToJoinNext ? "Ya" : "Tidak",
                Dikirim: app.survey?.submittedAt?.toISOString(),
                Masukan: app.survey?.feedback,
              }
            : {
                Brand: app.tenant.brandName,
                PIC: app.tenant.picName,
                WhatsApp: app.tenant.picPhone,
                Status: app.status,
                Stan: app.assignedBooth?.code,
                Tagihan: app.infaqAmountRupiah,
                Terverifikasi: bazaarPaymentConfirmed(app) ? "Ya" : "Belum",
              },
        );
        await logExportEvent({
          actorUserId: ctx.user!.id,
          exportType: "bazaar_" + body.kind,
          rowCount: rows.length,
          reason: body.reason,
          filterJson: { eventId: ctx.params.id, ids: body.ids },
          requestId: ctx.requestId,
        });
        return { csv: recordsToCsv(rows), count: rows.length };
      },
    ),
  );

  // 9. PUBLIC PORTAL
  // Public List of Active Bazaars (Across all events)
  router.get("/api/public/bazaars", async (ctx) => {
    const db = getDb();
    await ensureBazaarTablesExist(db);

    const bazaars = await db.query.bazaarEvents.findMany({
      where: eq(bazaarEvents.isOpen, true),
      orderBy: [desc(bazaarEvents.createdAt)],
      with: {
        event: true,
        booths: true,
      },
    });

    const list = bazaars
      .filter((b) => bazaarRegistrationOpen(b, b.event))
      .map((b) => {
        const boothPrices = (b.booths || [])
          .map((booth) => booth.priceRupiah)
          .filter((p) => typeof p === "number" && p > 0);
        const minFeeRupiah =
          boothPrices.length > 0
            ? Math.min(...boothPrices)
            : b.defaultFeeRupiah;
        const maxFeeRupiah =
          boothPrices.length > 0
            ? Math.max(...boothPrices)
            : b.defaultFeeRupiah;

        return {
          id: b.id,
          eventId: b.eventId,
          title: b.title,
          description: b.description,
          defaultFeeRupiah: b.defaultFeeRupiah,
          minFeeRupiah,
          maxFeeRupiah,
          registrationDeadline: b.registrationDeadline,
          paymentDeadline: b.paymentDeadline,
          isOpen: b.isOpen,
          boothsCount: b.booths?.length || 0,
          availableBoothsCount:
            b.booths?.filter((booth) => booth.status === "available").length ||
            0,
          event: b.event
            ? {
                id: b.event.id,
                title: b.event.title,
                speaker: b.event.speaker,
                startAt: b.event.startAt,
                endAt: b.event.endAt,
                locationName: b.event.locationName,
              }
            : null,
        };
      });

    return successResponse(list, { requestId: ctx.requestId });
  });

  router.get("/api/public/events/:id/bazaar", async (ctx) => {
    const db = getDb();
    await ensureBazaarTablesExist(db);
    const eventId = ctx.params?.id;

    if (!eventId) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Event ID diperlukan.",
        400,
        ctx.requestId,
      );
    }

    let eventRecord = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    let bazaar: any = null;
    if (eventRecord) {
      bazaar = await db.query.bazaarEvents.findFirst({
        where: eq(bazaarEvents.eventId, eventRecord.id),
        with: {
          booths: {
            orderBy: [asc(bazaarBooths.zone), asc(bazaarBooths.code)],
          },
          applications: {
            with: {
              tenant: true,
              assignedBooth: true,
            },
          },
        },
      });
    } else {
      bazaar = await db.query.bazaarEvents.findFirst({
        where: eq(bazaarEvents.id, eventId),
        with: {
          booths: {
            orderBy: [asc(bazaarBooths.zone), asc(bazaarBooths.code)],
          },
          applications: {
            with: {
              tenant: true,
              assignedBooth: true,
            },
          },
        },
      });
      if (bazaar) {
        eventRecord = await db.query.events.findFirst({
          where: eq(events.id, bazaar.eventId),
        });
      }
    }

    if (!bazaar || !eventRecord) {
      return errorResponse(
        "NOT_FOUND",
        "Bazar atau jadwal kajian tidak ditemukan.",
        404,
        ctx.requestId,
      );
    }

    const sanitizedBooths = (bazaar.booths || []).map((b: any) => ({
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

    const showcaseTenants = (bazaar.applications || [])
      .filter(
        (a: any) =>
          a.isPublished &&
          BAZAAR_PLACED.includes(a.status) &&
          bazaarPaymentConfirmed(a),
      )
      .map((a: any) => {
        const tenant = a.tenant;
        const booth = a.assignedBooth;
        return {
          id: tenant?.id || a.tenantId,
          tenantId: tenant?.id || a.tenantId,
          brandName: tenant?.brandName || "Tenant UMKM",
          picName: "",
          picPhone: "",
          picEmail: null,
          businessCategory: tenant?.businessCategory || "kuliner",
          logoUrl: tenant?.logoUrl || null,
          productDescription: tenant?.productDescription || null,
          instagram: tenant?.instagram || null,
          threads: tenant?.threads || null,
          websiteUrl: tenant?.websiteUrl || null,
          googleDriveCatalogUrl: tenant?.googleDriveCatalogUrl || null,
          catalogUrls: tenant?.catalogUrls || [],
          booth: booth
            ? {
                id: booth.id,
                code: booth.code,
                name: booth.name,
                zone: booth.zone,
                size: booth.size,
                facilities: booth.facilities,
              }
            : null,
          boothCode: booth?.code || null,
          status: a.status,
          isPublished: a.isPublished ?? true,
        };
      });

    const registeredTenants = showcaseTenants.map((st: any) => ({
      id: st.id,
      brandName: st.brandName,
      picName: st.picName,
      category: st.businessCategory,
      boothCode: st.boothCode,
      status: st.status,
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
          isOpen: bazaarRegistrationOpen(bazaar, eventRecord),
          paymentConfigured: bazaarBankConfigured(bazaar),
          rulesAndTerms: bazaar.rulesAndTerms,
          defaultFeeRupiah: bazaar.defaultFeeRupiah,
          bankName: bazaarBankConfigured(bazaar) ? bazaar.bankName : null,
          bankAccountNumber: bazaarBankConfigured(bazaar)
            ? bazaar.bankAccountNumber
            : null,
          bankAccountName: bazaarBankConfigured(bazaar)
            ? bazaar.bankAccountName
            : null,
          paymentInstructions: bazaarBankConfigured(bazaar)
            ? bazaar.paymentInstructions
            : null,
          registrationDeadline: bazaar.registrationDeadline,
          paymentDeadline: bazaar.paymentDeadline,
          surveyDeadline: bazaar.surveyDeadline,
          surveyEnabled: bazaar.surveyEnabled,
          layoutZones: bazaar.layoutZones,
          categoryQuotas: bazaar.categoryQuotas || null,
          booths: sanitizedBooths,
          registeredTenants,
          showcaseTenants,
        },
      },
      { requestId: ctx.requestId },
    );
  });

  // Public Tenant Application Submission
  router.post(
    "/api/public/events/:id/bazaar/apply",
    bazaarOperation(
      publicApplySchema,
      async (ctx, body) => publicApplyBazaar(ctx.params.id!, body),
      true,
    ),
  );

  // Public Survey Submission
  router.post(
    "/api/public/events/:id/bazaar/survey",
    bazaarOperation(
      publicSurveySchema,
      async (ctx, body) =>
        submitBazaarSurvey(ctx.params.id!, body, readBazaarAccess(ctx.headers)),
      true,
    ),
  );

  // Public Tenant Application Status Tracker
  router.get("/api/public/events/:id/bazaar/check-status", async (ctx) => {
    const db = getDb();
    await ensureBazaarTablesExist(db);
    const eventId = ctx.params?.id;
    if (!eventId) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Event ID diperlukan.",
        400,
        ctx.requestId,
      );
    }

    const access = readBazaarAccess(ctx.headers);
    if (!access)
      return errorResponse(
        "UNAUTHENTICATED",
        "Masukkan kode akses pribadi dari bukti pendaftaran atau hubungi panitia.",
        401,
        ctx.requestId,
      );
    const appId = access.applicationId;
    let bazaar = await db.query.bazaarEvents.findFirst({
      where: or(
        eq(bazaarEvents.eventId, eventId),
        eq(bazaarEvents.id, eventId),
      ),
      with: {
        event: true,
      },
    });

    if (!bazaar) {
      return errorResponse(
        "NOT_FOUND",
        "Bazar tidak ditemukan.",
        404,
        ctx.requestId,
      );
    }

    let application: any = null;

    if (appId && access.bazaarId === bazaar.id) {
      application = await db.query.bazaarApplications.findFirst({
        where: and(
          eq(bazaarApplications.id, appId),
          eq(bazaarApplications.bazaarId, bazaar.id),
        ),
        with: {
          tenant: true,
          assignedBooth: true,
        },
      });
    }

    if (!application) {
      return errorResponse(
        "NOT_FOUND",
        "Data pendaftaran tidak ditemukan. Pastikan Nomor WhatsApp atau ID Pendaftaran sesuai.",
        404,
        ctx.requestId,
      );
    }

    return successResponse(
      {
        application: {
          id: application.id,
          status: application.status,
          registeredAt: application.registeredAt,
          updatedAt: application.updatedAt,
          electricityNeeded: application.electricityNeeded,
          electricityWatts: application.electricityWatts,
          specialRequests: application.specialRequests,
          boothPreferences: application.boothPreferences,
          infaqAmountRupiah: application.infaqAmountRupiah,
          paymentProofUrl: application.paymentProofUrl,
          paymentVerifiedAt: application.paymentVerifiedAt,

          rejectionReason: application.rejectionReason,
          isPublished: application.isPublished,
        },
        tenant: {
          id: application.tenant?.id,
          brandName: application.tenant?.brandName,
          businessCategory: application.tenant?.businessCategory,
          picName: application.tenant?.picName,
          picPhone: application.tenant?.picPhone,
          picEmail: application.tenant?.picEmail,
          address: application.tenant?.address,
          instagram: application.tenant?.instagram,
          catalogUrl: application.tenant?.catalogUrl,
          productDescription: application.tenant?.productDescription,
        },
        assignedBooth:
          application.isPublished && application.assignedBooth
            ? {
                id: application.assignedBooth.id,
                code: application.assignedBooth.code,
                name: application.assignedBooth.name,
                zone: application.assignedBooth.zone,
                size: application.assignedBooth.size,
                facilities: application.assignedBooth.facilities,
                priceRupiah: application.assignedBooth.priceRupiah,
              }
            : null,
        bazaar: {
          id: bazaar.id,
          title: bazaar.title,
          defaultFeeRupiah: bazaar.defaultFeeRupiah,
          paymentConfigured: bazaarBankConfigured(bazaar),
          bankName: bazaarBankConfigured(bazaar) ? bazaar.bankName : null,
          bankAccountNumber: bazaarBankConfigured(bazaar)
            ? bazaar.bankAccountNumber
            : null,
          bankAccountName: bazaarBankConfigured(bazaar)
            ? bazaar.bankAccountName
            : null,
          paymentInstructions: bazaarBankConfigured(bazaar)
            ? bazaar.paymentInstructions
            : null,
        },
        event: bazaar.event
          ? {
              id: bazaar.event.id,
              title: bazaar.event.title,
              startAt: bazaar.event.startAt,
              locationName: bazaar.event.locationName,
              speaker: bazaar.event.speaker,
            }
          : null,
      },
      { requestId: ctx.requestId },
    );
  });

  // Public Upload Proof of Payment (Susulan)
  router.post(
    "/api/public/events/:id/bazaar/upload-proof",
    bazaarOperation(
      publicUploadProofSchema,
      async (ctx, body) =>
        uploadBazaarProof(ctx.params.id!, body, readBazaarAccess(ctx.headers)),
      true,
    ),
  );
}
