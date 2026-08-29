import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  persons,
  donations,
  donorStageHistory,
  tasks,
} from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';
import { logAuditEvent } from '../../audit/service';

export const DONOR_STAGES = [
  { id: 'new_lead', name: 'New Lead', title: 'Prospek Baru', desc: 'Belum pernah berinfaq, baru terdaftar', color: 'slate' },
  { id: 'contacted', name: 'Contacted', title: 'Sudah Dihubungi', desc: 'Telah disapa oleh tim CS / Amil', color: 'blue' },
  { id: 'interested', name: 'Interested', title: 'Berminat Infaq', desc: 'Konsultasi program & menyatakan minat', color: 'amber' },
  { id: 'donated_once', name: 'Donated Once', title: 'Donasi Pertama', desc: 'Telah menyalurkan infaq perdana', color: 'emerald' },
  { id: 'regular_donor', name: 'Regular Donor', title: 'Donatur Rutin', desc: 'Infaq berkala minimal 2x', color: 'teal' },
  { id: 'loyal', name: 'Loyal', title: 'Donatur Utama & Loyal', desc: 'Donatur setia $\\ge$ 5x / bernilai tinggi', color: 'purple' },
  { id: 'dormant', name: 'Dormant', title: 'Dorman (Perlu Re-engage)', desc: 'Tidak ada mutasi $>90$ hari sejak donasi terakhir', color: 'rose' },
] as const;

export type DonorStageId = (typeof DONOR_STAGES)[number]['id'];

const transitionStageSchema = z.object({
  targetStage: z.enum(['new_lead', 'contacted', 'interested', 'donated_once', 'regular_donor', 'loyal', 'dormant']),
  reason: z.string().min(3, 'Alasan perpindahan tahapan pipeline wajib diisi'),
  createTask: z.boolean().optional(),
  taskDueDays: z.number().min(1).max(30).optional().default(3),
});

const reEngageSchema = z.object({
  notes: z.string().optional().nullable(),
  programFocus: z.string().optional().nullable(),
});

let cachedMetrics: {
  totalPipelineDonors: number;
  totalDonatedDonors: number;
  conversionRatePercent: number;
  totalPipelineValueRupiah: number;
  regularCount: number;
  loyalCount: number;
  dormantCount: number;
  cachedAt: number;
} | null = null;
const METRICS_CACHE_TTL_MS = 60 * 1000;

export function registerDonorsPipelineRoutes(router: Router) {
  // 1. GET /api/donors/pipeline (Kanban Board, Table Pagination & Lifecycle Metrics)
  router.get(
    '/api/donors/pipeline',
    requireAuth(
      requirePermission(PERMISSIONS.DONATIONS_LIST, async (ctx) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const page = Math.max(1, parseInt((ctx.query.page as string) || '1', 10));
        const pageSize = Math.min(100, Math.max(5, parseInt((ctx.query.pageSize as string) || '15', 10)));
        const searchQuery = ((ctx.query.search as string) || '').trim().toLowerCase();
        const stageFilter = ((ctx.query.stage as string) || 'all').trim();
        const sortBy = ((ctx.query.sortBy as string) || 'recent').trim();

        const allPersons = await db.query.persons.findMany({
          where: eq(persons.isActive, true),
          with: {
            owner: {
              columns: { id: true, fullName: true, email: true },
            },
          },
          orderBy: [desc(persons.updatedAt)],
        });

        // Fetch verified donations aggregate per person
        const donationStats = await db
          .select({
            personId: donations.personId,
            totalDonationsCount: sql<number>`count(*)::int`,
            totalAmountRupiah: sql<string>`coalesce(sum(${donations.amountRupiah}), 0)`,
            lastDonationDate: sql<Date | null>`max(${donations.donationDate})`,
          })
          .from(donations)
          .where(eq(donations.verificationStatus, 'verified'))
          .groupBy(donations.personId);

        const statsMap = new Map<string, { count: number; total: number; lastDate: Date | null }>();
        for (const s of donationStats) {
          if (s.personId) {
            statsMap.set(s.personId, {
              count: s.totalDonationsCount,
              total: Number(s.totalAmountRupiah),
              lastDate: s.lastDonationDate ? new Date(s.lastDonationDate) : null,
            });
          }
        }

        const now = Date.now();

        // Group into 7 columns and flat list
        const columns: Record<DonorStageId, any[]> = {
          new_lead: [],
          contacted: [],
          interested: [],
          donated_once: [],
          regular_donor: [],
          loyal: [],
          dormant: [],
        };

        const allCards: any[] = [];

        for (const p of allPersons) {
          const stats = statsMap.get(p.id) || { count: 0, total: 0, lastDate: null };
          let currentStage = p.donorStage as DonorStageId;

          // Recency check for dormancy
          const daysSinceLast = stats.lastDate ? Math.floor((now - stats.lastDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

          const card = {
            id: p.id,
            fullName: p.fullName,
            phoneE164: p.phoneE164,
            email: p.email,
            gender: p.gender,
            cityRegency: p.cityRegency || 'Kota Belum Terdata',
            donorStage: currentStage,
            totalDonationsCount: stats.count,
            totalAmountRupiah: stats.total,
            lastDonationDate: stats.lastDate,
            daysSinceLastDonation: daysSinceLast,
            owner: p.owner || null,
            updatedAt: p.updatedAt,
          };

          if (columns[currentStage]) {
            columns[currentStage].push(card);
          } else {
            columns.new_lead.push(card);
          }

          allCards.push(card);
        }

        // Metrics Caching or Computation
        if (!cachedMetrics || now - cachedMetrics.cachedAt > METRICS_CACHE_TTL_MS) {
          const totalPeople = allPersons.length;
          const totalDonatedPeople = Array.from(statsMap.values()).filter((s) => s.count > 0).length;
          const conversionRate = totalPeople > 0 ? Math.round((totalDonatedPeople / totalPeople) * 100) : 0;
          const totalPipelineValue = Array.from(statsMap.values()).reduce((acc, curr) => acc + curr.total, 0);

          cachedMetrics = {
            totalPipelineDonors: totalPeople,
            totalDonatedDonors: totalDonatedPeople,
            conversionRatePercent: conversionRate,
            totalPipelineValueRupiah: totalPipelineValue,
            regularCount: columns.regular_donor.length,
            loyalCount: columns.loyal.length,
            dormantCount: columns.dormant.length,
            cachedAt: now,
          };
        }

        // Filtering & Sorting for Table View
        let filteredCards = allCards;
        if (searchQuery) {
          filteredCards = filteredCards.filter(
            (c) =>
              c.fullName.toLowerCase().includes(searchQuery) ||
              (c.phoneE164 && c.phoneE164.includes(searchQuery)) ||
              (c.email && c.email.toLowerCase().includes(searchQuery)) ||
              c.cityRegency.toLowerCase().includes(searchQuery)
          );
        }

        if (stageFilter && stageFilter !== 'all') {
          filteredCards = filteredCards.filter((c) => c.donorStage === stageFilter);
        }

        if (sortBy === 'amount') {
          filteredCards.sort((a, b) => b.totalAmountRupiah - a.totalAmountRupiah);
        } else if (sortBy === 'donations') {
          filteredCards.sort((a, b) => b.totalDonationsCount - a.totalDonationsCount);
        } else if (sortBy === 'name') {
          filteredCards.sort((a, b) => a.fullName.localeCompare(b.fullName));
        } else {
          // recent
          filteredCards.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }

        const totalCount = filteredCards.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const paginatedItems = filteredCards.slice((page - 1) * pageSize, page * pageSize);

        return successResponse(
          {
            stages: DONOR_STAGES,
            columns,
            metrics: cachedMetrics,
            items: paginatedItems,
            totalCount,
            totalPages,
            page,
            pageSize,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 2. POST /api/donors/:id/transition-stage (Move Stage & Record History)
  router.post(
    '/api/donors/:id/transition-stage',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_CREATE,
        validateBody(transitionStageSchema, async (ctx, body) => {
          const db = getDb();
          const personId = ctx.params.id;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
          if (!personId) return errorResponse('VALIDATION_ERROR', 'ID Donatur diperlukan', 400, ctx.requestId);

          const current = await db.query.persons.findFirst({
            where: eq(persons.id, personId),
          });

          if (!current) {
            return errorResponse('NOT_FOUND', 'Profil donatur tidak ditemukan', 404, ctx.requestId);
          }

          const fromStage = current.donorStage;
          const toStage = body.targetStage;

          const [updated] = await db
            .update(persons)
            .set({
              donorStage: toStage,
              updatedAt: new Date(),
            })
            .where(eq(persons.id, personId))
            .returning();

          if (!updated) {
            return errorResponse('INTERNAL_ERROR', 'Gagal memperbarui tahapan pipeline', 500, ctx.requestId);
          }

          // Record Stage History
          await db.insert(donorStageHistory).values({
            personId,
            fromStage: fromStage as any,
            toStage: toStage as any,
            reason: body.reason,
            changedBy: user.id,
          });

          // Optional: Create Follow-Up Task
          let createdTask = null;
          if (body.createTask) {
            const dueDays = body.taskDueDays ?? 3;
            const dueAt = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
            const [newTask] = await db
              .insert(tasks)
              .values({
                personId,
                title: `Follow-up Pipeline: [${toStage.toUpperCase()}] ${current.fullName}`,
                description: `Pemberitahuan perubahan tahapan donatur ke ${toStage}: ${body.reason}`,
                priority: toStage === 'dormant' || toStage === 'loyal' ? 'high' : 'medium',
                status: 'pending',
                ownerUserId: user.id,
                assignedBy: user.id,
                dueAt,
              })
              .returning();
            createdTask = newTask;
          }

          cachedMetrics = null;

          // Log Audit Event
          await logAuditEvent({
            actorUserId: user.id,
            action: 'transition_donor_stage',
            entityType: 'person',
            entityId: personId,
            beforeJson: { donorStage: fromStage },
            afterJson: { donorStage: toStage, reason: body.reason },
            reason: body.reason,
            requestId: ctx.requestId,
          });

          return successResponse(
            {
              person: updated,
              fromStage,
              toStage,
              createdTask,
            },
            { requestId: ctx.requestId }
          );
        })
      )
    )
  );

  // 3. POST /api/donors/auto-sync-stages (Auto-recalculate All Stages based on Transactions)
  router.post(
    '/api/donors/auto-sync-stages',
    requireAuth(
      requirePermission(PERMISSIONS.DONATIONS_CREATE, async (ctx) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const allPersons = await db.query.persons.findMany({
          where: eq(persons.isActive, true),
        });

        const donationStats = await db
          .select({
            personId: donations.personId,
            count: sql<number>`count(*)::int`,
            total: sql<string>`coalesce(sum(${donations.amountRupiah}), 0)`,
            lastDate: sql<Date | null>`max(${donations.donationDate})`,
          })
          .from(donations)
          .where(eq(donations.verificationStatus, 'verified'))
          .groupBy(donations.personId);

        const statsMap = new Map<string, { count: number; total: number; lastDate: Date | null }>();
        for (const s of donationStats) {
          if (s.personId) {
            statsMap.set(s.personId, {
              count: s.count,
              total: Number(s.total),
              lastDate: s.lastDate ? new Date(s.lastDate) : null,
            });
          }
        }

        const now = Date.now();
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
        let updatedCount = 0;

        for (const p of allPersons) {
          const stats = statsMap.get(p.id) || { count: 0, total: 0, lastDate: null };
          let evaluatedStage: DonorStageId = 'new_lead';

          if (stats.count === 0) {
            // Keep contacted or interested if manually tagged, otherwise new_lead
            evaluatedStage = p.donorStage === 'contacted' || p.donorStage === 'interested' ? (p.donorStage as DonorStageId) : 'new_lead';
          } else if (stats.lastDate && now - stats.lastDate.getTime() > ninetyDaysMs) {
            evaluatedStage = 'dormant';
          } else if (stats.count >= 5 || stats.total >= 10_000_000) {
            evaluatedStage = 'loyal';
          } else if (stats.count >= 2) {
            evaluatedStage = 'regular_donor';
          } else if (stats.count === 1) {
            evaluatedStage = 'donated_once';
          }

          if (evaluatedStage !== p.donorStage) {
            await db
              .update(persons)
              .set({ donorStage: evaluatedStage, updatedAt: new Date() })
              .where(eq(persons.id, p.id));

            await db.insert(donorStageHistory).values({
              personId: p.id,
              fromStage: p.donorStage as any,
              toStage: evaluatedStage as any,
              reason: `Sinkronisasi otomatis mutasi donasi (Frekuensi: ${stats.count}x, Total: Rp ${stats.total.toLocaleString('id-ID')})`,
              changedBy: user.id,
            });

            updatedCount++;
          }
        }

        cachedMetrics = null;

        await logAuditEvent({
          actorUserId: user.id,
          action: 'auto_sync_donor_stages',
          entityType: 'donor_pipeline',
          entityId: user.id,
          afterJson: { totalPersons: allPersons.length, updatedCount },
          reason: 'Sinkronisasi masal tahapan donatur berbasis histori mutasi',
          requestId: ctx.requestId,
        });

        return successResponse(
          { totalEvaluated: allPersons.length, updatedCount },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 4. POST /api/donors/:id/re-engage (1-Click Dormant Re-engagement with WhatsApp Template)
  router.post(
    '/api/donors/:id/re-engage',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_CREATE,
        validateBody(reEngageSchema, async (ctx, body) => {
          const db = getDb();
          const personId = ctx.params.id;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
          if (!personId) return errorResponse('VALIDATION_ERROR', 'ID Donatur diperlukan', 400, ctx.requestId);

          const person = await db.query.persons.findFirst({
            where: eq(persons.id, personId),
          });

          if (!person) return errorResponse('NOT_FOUND', 'Profil donatur tidak ditemukan', 404, ctx.requestId);

          const programText = body.programFocus || 'Operasional Dakwah & Santunan Dhuafa Tarbiyah Sunnah';
          const notesText = body.notes || 'Menyambung silaturahmi berkah dan mengabarkan perkembangan dakwah terkini.';

          const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${person.fullName},\n\nSemoga Bapak/Ibu senantiasa dalam keadaan sehat wal 'afiat serta dilimpahkan berkah oleh Allah Ta'ala.\n\nKami dari Yayasan Tarbiyah Sunnah ingin bersilaturahmi kembali dan menyampaikan kabar gembira mengenai perkembangan dakwah pada program *${programText}*:\n\n📝 ${notesText}\n\nTerima kasih atas kebaikan yang pernah Bapak/Ibu salurkan. Semoga Allah memudahkan setiap urusan dan membalasnya dengan sebaik-baik balasan. Barakallahu fiikum.\n\n— Tim Sahabat Infaq Yayasan Tarbiyah Sunnah`;

          const phoneClean = person.phoneE164 ? person.phoneE164.replace(/[^0-9]/g, '') : null;
          const waDirectUrl = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}` : null;

          // Create follow up task
          const [newTask] = await db
            .insert(tasks)
            .values({
              personId: person.id,
              title: `Re-engage Donatur Dorman: ${person.fullName}`,
              description: `Silaturahmi ulang donatur dorman via WhatsApp / Telepon: ${notesText}`,
              priority: 'high',
              status: 'in_progress',
              ownerUserId: user.id,
              assignedBy: user.id,
              dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            })
            .returning();

          await logAuditEvent({
            actorUserId: user.id,
            action: 're_engage_dormant_donor',
            entityType: 'person',
            entityId: person.id,
            afterJson: { programFocus: programText, taskId: newTask?.id },
            reason: `Re-engagement donatur dorman oleh ${user.fullName}`,
            requestId: ctx.requestId,
          });

          return successResponse(
            {
              personId: person.id,
              fullName: person.fullName,
              phoneE164: person.phoneE164,
              message,
              waDirectUrl,
              task: newTask,
            },
            { requestId: ctx.requestId }
          );
        })
      )
    )
  );
}
