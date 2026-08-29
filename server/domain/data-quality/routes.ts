import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { 
  persons, 
  personRoles, 
  personTags, 
  sensitiveNotes, 
  interactions, 
  tasks, 
  donations, 
  waqfCases, 
  eventAttendance, 
  auditLogs 
} from '../../db/schema';
import { eq, and, isNull, desc, lte } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';
import { normalizeIndonesianPhone, isValidE164 } from '../../lib/phone';

// In-memory TTL Cache (60 seconds) for Data Quality anomalies
interface CacheEntry {
  data: any;
  timestamp: number;
}
let dataQualityCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000;

export function invalidateDataQualityCache() {
  dataQualityCache = null;
}

const mergePersonsSchema = z.object({
  primaryPersonId: z.string().uuid('ID Jamaah Utama (Target Merge) wajib valid'),
  secondaryPersonId: z.string().uuid('ID Jamaah Duplikat (Source Merge) wajib valid'),
  reason: z.string().min(5, 'Alasan penggabungan (merge) data wajib diisi minimal 5 karakter'),
  fieldPreferences: z.object({
    phoneE164: z.enum(['primary', 'secondary']).optional(),
    email: z.enum(['primary', 'secondary']).optional(),
    cityRegency: z.enum(['primary', 'secondary']).optional(),
    gender: z.enum(['primary', 'secondary']).optional(),
    sourceCode: z.enum(['primary', 'secondary']).optional(),
  }).optional(),
  fieldOverrides: z.record(z.any()).optional(),
});

const ignoreCandidateSchema = z.object({
  personAId: z.string().uuid(),
  personBId: z.string().uuid(),
  reason: z.string().min(3, 'Alasan pengabaian duplikasi wajib diisi'),
});

const quickFixFieldSchema = z.object({
  personId: z.string().uuid(),
  field: z.enum(['phoneE164', 'email', 'cityRegency', 'gender', 'sourceCode']),
  value: z.string().min(1, 'Nilai perbaikan wajib diisi'),
  reason: z.string().optional(),
});

/**
 * Helper to compute token-based similarity score between 2 strings (0 to 1)
 */
function computeStringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1.0;

  const words1 = s1.split(/\s+/).filter((w) => w.length > 1);
  const words2 = s2.split(/\s+/).filter((w) => w.length > 1);
  if (words1.length === 0 || words2.length === 0) return 0;

  let matches = 0;
  for (const w1 of words1) {
    if (words2.some((w2) => w2 === w1 || w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  }

  return (2 * matches) / (words1.length + words2.length);
}

export function registerDataQualityRoutes(router: Router) {
  // GET /api/data-quality/anomalies (7 Anomaly Detection Rules Engine with Caching)
  router.get(
    '/api/data-quality/anomalies',
    requireAuth(
      requirePermission(PERMISSIONS.DATA_QUALITY_MANAGE, async (ctx) => {
        const forceRefresh = ctx.query?.refresh === 'true' || ctx.query?.refresh === '1';
        if (!forceRefresh && dataQualityCache && Date.now() - dataQualityCache.timestamp < CACHE_TTL_MS) {
          return successResponse(dataQualityCache.data, { requestId: ctx.requestId });
        }

        const db = getDb();
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        // Fetch all active persons to evaluate quality rules
        const activePersons = await db.query.persons.findMany({
          where: eq(persons.isActive, true),
          orderBy: [desc(persons.createdAt)],
          with: {
            owner: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        });

        // 1. Invalid Phone Rule (Phone exists but not valid E.164)
        const invalidPhonePersons = activePersons.filter((p) => {
          if (!p.phoneE164) return false;
          return !isValidE164(p.phoneE164);
        });

        // 2. Duplicate Exact Phone Rule
        const phoneMap = new Map<string, typeof activePersons>();
        for (const p of activePersons) {
          if (p.phoneE164) {
            const normalized = normalizeIndonesianPhone(p.phoneE164);
            const list = phoneMap.get(normalized) || [];
            list.push(p);
            phoneMap.set(normalized, list);
          }
        }

        const duplicateExactPhones: Array<{ phone: string; count: number; persons: typeof activePersons }> = [];
        phoneMap.forEach((list, phone) => {
          if (list.length > 1) {
            duplicateExactPhones.push({ phone, count: list.length, persons: list });
          }
        });

        // 3. Duplicate Email Rule
        const emailMap = new Map<string, typeof activePersons>();
        for (const p of activePersons) {
          if (p.email && p.email.trim()) {
            const cleanEmail = p.email.toLowerCase().trim();
            const list = emailMap.get(cleanEmail) || [];
            list.push(p);
            emailMap.set(cleanEmail, list);
          }
        }

        const duplicateEmails: Array<{ email: string; count: number; persons: typeof activePersons }> = [];
        emailMap.forEach((list, email) => {
          if (list.length > 1) {
            duplicateEmails.push({ email, count: list.length, persons: list });
          }
        });

        // 4. Fuzzy Name + Same City Candidates Rule (Never Auto-Merged!)
        const fuzzyDuplicates: Array<{
          similarityScore: number;
          reason: string;
          personA: typeof activePersons[0];
          personB: typeof activePersons[0];
        }> = [];

        // Group persons by city to compare candidates efficiently
        const cityMap = new Map<string, typeof activePersons>();
        for (const p of activePersons) {
          const cityKey = (p.cityRegency || 'unknown').toLowerCase().trim();
          const list = cityMap.get(cityKey) || [];
          list.push(p);
          cityMap.set(cityKey, list);
        }

        cityMap.forEach((list) => {
          if (list.length < 2) return;
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              const pA = list[i];
              const pB = list[j];
              if (!pA || !pB) continue;
              // Skip if exact phone or exact email already grouped
              if (pA.phoneE164 && pB.phoneE164 && pA.phoneE164 === pB.phoneE164) continue;
              if (pA.email && pB.email && pA.email.toLowerCase() === pB.email.toLowerCase()) continue;

              const similarity = computeStringSimilarity(pA.fullName, pB.fullName);
              if (similarity >= 0.7) {
                fuzzyDuplicates.push({
                  similarityScore: Math.round(similarity * 100),
                  reason: `Kemiripan nama ${Math.round(similarity * 100)}% di domisili yang sama (${pA.cityRegency || 'Sama'})`,
                  personA: pA,
                  personB: pB,
                });
              }
            }
          }
        });

        // 5. Incomplete Key Profile Rule (Missing Phone, City, or Gender)
        const incompleteProfiles = activePersons.filter((p) => {
          return !p.phoneE164 || !p.cityRegency || !p.gender;
        }).map((p) => ({
          ...p,
          missingFields: [
            !p.phoneE164 ? 'Nomor Telepon' : null,
            !p.cityRegency ? 'Kota/Kabupaten' : null,
            !p.gender ? 'Jenis Kelamin' : null,
          ].filter(Boolean),
        }));

        // 6. Missing Source Rule (sourceCode is empty or default)
        const missingSourcePersons = activePersons.filter((p) => {
          return !p.sourceCode || p.sourceCode === '-' || p.sourceCode.trim() === '';
        });

        // 7. Stale Sensitive Notes Rule (Created > 90 days ago)
        const staleNotesList = await db.query.sensitiveNotes.findMany({
          where: and(isNull(sensitiveNotes.deletedAt), lte(sensitiveNotes.createdAt, ninetyDaysAgo)),
          orderBy: [desc(sensitiveNotes.createdAt)],
          with: {
            person: {
              columns: {
                id: true,
                fullName: true,
              },
            },
            creator: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        });

        const responsePayload = {
            summary: {
              totalActivePersons: activePersons.length,
              invalidPhoneCount: invalidPhonePersons.length,
              duplicatePhoneClustersCount: duplicateExactPhones.length,
              duplicateEmailClustersCount: duplicateEmails.length,
              fuzzyDuplicateCandidatesCount: fuzzyDuplicates.length,
              incompleteProfilesCount: incompleteProfiles.length,
              missingSourceCount: missingSourcePersons.length,
              staleSensitiveNotesCount: staleNotesList.length,
              totalIssuesCount:
                invalidPhonePersons.length +
                duplicateExactPhones.length +
                duplicateEmails.length +
                fuzzyDuplicates.length +
                incompleteProfiles.length +
                missingSourcePersons.length +
                staleNotesList.length,
            },
            anomalies: {
              invalidPhones: invalidPhonePersons.map((p) => ({
                id: p.id,
                fullName: p.fullName,
                phoneRaw: p.phoneE164,
                suggestedE164: normalizeIndonesianPhone(p.phoneE164 || ''),
                cityRegency: p.cityRegency,
                ownerName: p.owner?.fullName || 'Belum Ada',
              })),
              duplicateExactPhones: duplicateExactPhones.map((d) => ({
                phone: d.phone,
                count: d.count,
                persons: d.persons.map((p) => ({
                  id: p.id,
                  fullName: p.fullName,
                  email: p.email,
                  cityRegency: p.cityRegency,
                  engagementStatus: p.engagementStatus,
                  createdAt: p.createdAt,
                  ownerName: p.owner?.fullName || 'Belum Ada',
                })),
              })),
              duplicateEmails: duplicateEmails.map((d) => ({
                email: d.email,
                count: d.count,
                persons: d.persons.map((p) => ({
                  id: p.id,
                  fullName: p.fullName,
                  phoneE164: p.phoneE164,
                  cityRegency: p.cityRegency,
                  engagementStatus: p.engagementStatus,
                  createdAt: p.createdAt,
                  ownerName: p.owner?.fullName || 'Belum Ada',
                })),
              })),
              fuzzyDuplicates: fuzzyDuplicates.map((f) => ({
                similarityScore: f.similarityScore,
                reason: f.reason,
                personA: {
                  id: f.personA.id,
                  fullName: f.personA.fullName,
                  phoneE164: f.personA.phoneE164,
                  email: f.personA.email,
                  cityRegency: f.personA.cityRegency,
                  engagementStatus: f.personA.engagementStatus,
                  createdAt: f.personA.createdAt,
                },
                personB: {
                  id: f.personB.id,
                  fullName: f.personB.fullName,
                  phoneE164: f.personB.phoneE164,
                  email: f.personB.email,
                  cityRegency: f.personB.cityRegency,
                  engagementStatus: f.personB.engagementStatus,
                  createdAt: f.personB.createdAt,
                },
              })),
              incompleteProfiles: incompleteProfiles.slice(0, 50).map((p) => ({
                id: p.id,
                fullName: p.fullName,
                phoneE164: p.phoneE164,
                cityRegency: p.cityRegency,
                gender: p.gender,
                missingFields: p.missingFields,
                engagementStatus: p.engagementStatus,
                ownerName: p.owner?.fullName || 'Belum Ada',
              })),
              missingSource: missingSourcePersons.slice(0, 50).map((p) => ({
                id: p.id,
                fullName: p.fullName,
                phoneE164: p.phoneE164,
                cityRegency: p.cityRegency,
                engagementStatus: p.engagementStatus,
                createdAt: p.createdAt,
              })),
              staleNotes: staleNotesList.map((n) => ({
                id: n.id,
                personId: n.personId,
                personName: n.person?.fullName || 'Jamaah',
                noteText: n.noteText,
                sensitivityLevel: n.sensitivityLevel,
                createdAt: n.createdAt,
                authorName: n.creator?.fullName || 'Staf',
                ageDays: Math.floor((Date.now() - new Date(n.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
              })),
            },
          };

          dataQualityCache = {
            data: responsePayload,
            timestamp: Date.now(),
          };

          return successResponse(responsePayload, { requestId: ctx.requestId });
      })
    )
  );

  // Helper Merge Handler
  const handleMergeRequest = async (ctx: any, body: any) => {
    const db = getDb();
    const user = ctx.user;
    if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

    const { primaryPersonId, secondaryPersonId, reason, fieldPreferences, fieldOverrides } = body;

    if (primaryPersonId === secondaryPersonId) {
      return errorResponse('VALIDATION_ERROR', 'Jamaah utama dan duplikat tidak boleh identik', 400, ctx.requestId);
    }

    // Atomic Transaction for Complete Relational Merge
    const mergeResult = await db.transaction(async (tx) => {
      const primary = await tx.query.persons.findFirst({
        where: eq(persons.id, primaryPersonId),
      });
      const secondary = await tx.query.persons.findFirst({
        where: eq(persons.id, secondaryPersonId),
      });

      if (!primary || !secondary) {
        throw new Error('NOT_FOUND: Salah satu data jamaah tidak ditemukan');
      }

      if (!primary.isActive || !secondary.isActive) {
        throw new Error('VALIDATION_ERROR: Kedua data jamaah harus dalam status aktif sebelum penggabungan');
      }

      const beforeJson = {
        primaryPerson: { id: primary.id, fullName: primary.fullName, phoneE164: primary.phoneE164, email: primary.email },
        secondaryPerson: { id: secondary.id, fullName: secondary.fullName, phoneE164: secondary.phoneE164, email: secondary.email },
      };

      // 1. Reassign all interactions
      await tx
        .update(interactions)
        .set({ personId: primaryPersonId })
        .where(eq(interactions.personId, secondaryPersonId));

      // 2. Reassign all tasks
      await tx
        .update(tasks)
        .set({ personId: primaryPersonId })
        .where(eq(tasks.personId, secondaryPersonId));

      // 3. Reassign all donations
      await tx
        .update(donations)
        .set({ personId: primaryPersonId })
        .where(eq(donations.personId, secondaryPersonId));

      // 4. Reassign all waqf cases
      await tx
        .update(waqfCases)
        .set({ personId: primaryPersonId })
        .where(eq(waqfCases.personId, secondaryPersonId));

      // 5. Reassign event attendances (avoid unique index violation by deleting duplicates)
      const secondaryAttendances = await tx.query.eventAttendance.findMany({
        where: eq(eventAttendance.personId, secondaryPersonId),
      });

      for (const att of secondaryAttendances) {
        const existingAtt = await tx.query.eventAttendance.findFirst({
          where: and(eq(eventAttendance.eventId, att.eventId), eq(eventAttendance.personId, primaryPersonId)),
        });
        if (!existingAtt) {
          await tx
            .update(eventAttendance)
            .set({ personId: primaryPersonId })
            .where(eq(eventAttendance.id, att.id));
        } else {
          await tx
            .delete(eventAttendance)
            .where(eq(eventAttendance.id, att.id));
        }
      }

      // 6. Reassign sensitive notes
      await tx
        .update(sensitiveNotes)
        .set({ personId: primaryPersonId })
        .where(eq(sensitiveNotes.personId, secondaryPersonId));

      // 7. Merge Roles
      const secondaryRoles = await tx.query.personRoles.findMany({
        where: eq(personRoles.personId, secondaryPersonId),
      });
      for (const r of secondaryRoles) {
        const existingRole = await tx.query.personRoles.findFirst({
          where: and(eq(personRoles.personId, primaryPersonId), eq(personRoles.roleCode, r.roleCode)),
        });
        if (!existingRole) {
          await tx.insert(personRoles).values({
            personId: primaryPersonId,
            roleCode: r.roleCode,
          });
        }
      }

      // 8. Merge Tags
      const secondaryTags = await tx.query.personTags.findMany({
        where: eq(personTags.personId, secondaryPersonId),
      });
      for (const t of secondaryTags) {
        const existingTag = await tx.query.personTags.findFirst({
          where: and(eq(personTags.personId, primaryPersonId), eq(personTags.tagId, t.tagId)),
        });
        if (!existingTag) {
          await tx.insert(personTags).values({
            personId: primaryPersonId,
            tagId: t.tagId,
          });
        }
      }

      // 9. Update Primary Person Fields based on Preferences & Backfill
      const updatedPrimaryData: any = {
        phoneE164: fieldOverrides?.phoneE164 || (fieldPreferences?.phoneE164 === 'secondary' ? secondary.phoneE164 : (primary.phoneE164 || secondary.phoneE164)),
        email: fieldOverrides?.email || (fieldPreferences?.email === 'secondary' ? secondary.email : (primary.email || secondary.email)),
        cityRegency: fieldOverrides?.cityRegency || (fieldPreferences?.cityRegency === 'secondary' ? secondary.cityRegency : (primary.cityRegency || secondary.cityRegency)),
        gender: fieldOverrides?.gender || (fieldPreferences?.gender === 'secondary' ? secondary.gender : (primary.gender || secondary.gender)),
        sourceCode: fieldOverrides?.sourceCode || (fieldPreferences?.sourceCode === 'secondary' ? secondary.sourceCode : (primary.sourceCode || secondary.sourceCode)),
        occupation: primary.occupation || secondary.occupation,
        educationLevel: primary.educationLevel || secondary.educationLevel,
        updatedAt: new Date(),
      };

      const [mergedPrimary] = await tx
        .update(persons)
        .set(updatedPrimaryData)
        .where(eq(persons.id, primaryPersonId))
        .returning();

      if (!mergedPrimary) {
        throw new Error('INTERNAL_ERROR: Gagal memperbarui profil utama');
      }

      // 10. Deactivate Secondary Person
      await tx
        .update(persons)
        .set({
          isActive: false,
          fullName: `${secondary.fullName} [MERGED -> ${primary.fullName}]`,
          updatedAt: new Date(),
        })
        .where(eq(persons.id, secondaryPersonId));

      const afterJson = {
        mergedPrimaryId: primaryPersonId,
        deactivatedSecondaryId: secondaryPersonId,
        finalPrimaryState: {
          fullName: mergedPrimary.fullName,
          phoneE164: mergedPrimary.phoneE164,
          email: mergedPrimary.email,
          cityRegency: mergedPrimary.cityRegency,
        },
      };

      // 11. Audit Log for Merge Operation
      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        action: 'merge_persons',
        entityType: 'person',
        entityId: primaryPersonId,
        beforeJson,
        afterJson,
        reason,
        requestId: ctx.requestId,
      });

      return mergedPrimary;
    });

    invalidateDataQualityCache();
    return successResponse(mergeResult, { requestId: ctx.requestId });
  };

  // POST /api/data-quality/merge (Transactional Human-Reviewed Merge with Audit Log)
  router.post(
    '/api/data-quality/merge',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_MERGE,
        validateBody(mergePersonsSchema, handleMergeRequest)
      )
    )
  );

  // POST /api/data-quality/merge-persons (Alias)
  router.post(
    '/api/data-quality/merge-persons',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_MERGE,
        validateBody(mergePersonsSchema, handleMergeRequest)
      )
    )
  );

  // POST /api/data-quality/batch-normalize-phones (Batch normalize all fixable phone numbers)
  router.post(
    '/api/data-quality/batch-normalize-phones',
    requireAuth(
      requirePermission(PERMISSIONS.DATA_QUALITY_MANAGE, async (ctx) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const activePersons = await db.query.persons.findMany({
          where: eq(persons.isActive, true),
        });

        const fixable: Array<{ id: string; oldPhone: string; newPhone: string }> = [];
        for (const p of activePersons) {
          if (p.phoneE164 && !isValidE164(p.phoneE164)) {
            const normalized = normalizeIndonesianPhone(p.phoneE164);
            if (isValidE164(normalized)) {
              fixable.push({ id: p.id, oldPhone: p.phoneE164, newPhone: normalized });
            }
          }
        }

        if (fixable.length === 0) {
          return successResponse(
            { count: 0, message: 'Semua nomor telepon sudah berformat valid atau tidak dapat dinormalisasi otomatis.' },
            { requestId: ctx.requestId }
          );
        }

        await db.transaction(async (tx) => {
          for (const item of fixable) {
            await tx
              .update(persons)
              .set({ phoneE164: item.newPhone, updatedAt: new Date() })
              .where(eq(persons.id, item.id));
          }

          await tx.insert(auditLogs).values({
            actorUserId: user.id,
            action: 'batch_normalize_phones',
            entityType: 'person',
            entityId: fixable[0]!.id,
            beforeJson: { count: fixable.length, sample: fixable.slice(0, 5) },
            afterJson: { count: fixable.length, status: 'normalized' },
            reason: `Batch normalisasi E.164 untuk ${fixable.length} nomor kontak via Data Quality Steward`,
            requestId: ctx.requestId,
          });
        });

        invalidateDataQualityCache();
        return successResponse(
          { count: fixable.length, message: `Berhasil menormalisasi ${fixable.length} nomor telepon ke format E.164 (+62).` },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // POST /api/data-quality/quick-fix (Fix single invalid field with audit)
  router.post(
    '/api/data-quality/quick-fix',
    requireAuth(
      requirePermission(
        PERMISSIONS.DATA_QUALITY_MANAGE,
        validateBody(quickFixFieldSchema, async (ctx, body) => {
          const db = getDb();
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          const { personId, field, value, reason } = body;

          const current = await db.query.persons.findFirst({
            where: eq(persons.id, personId),
          });

          if (!current) {
            return errorResponse('NOT_FOUND', 'Jamaah tidak ditemukan', 404, ctx.requestId);
          }

          let finalValue: any = value.trim();
          if (field === 'phoneE164') {
            finalValue = normalizeIndonesianPhone(finalValue);
            if (!isValidE164(finalValue)) {
              return errorResponse('VALIDATION_ERROR', 'Format nomor telepon tidak valid E.164 (+62...)', 400, ctx.requestId);
            }
          }

          const [updated] = await db
            .update(persons)
            .set({
              [field]: finalValue,
              updatedAt: new Date(),
            })
            .where(eq(persons.id, personId))
            .returning();

          await db.insert(auditLogs).values({
            actorUserId: user.id,
            action: 'quick_fix_person_field',
            entityType: 'person',
            entityId: personId,
            beforeJson: { field, previousValue: (current as any)[field] },
            afterJson: { field, newValue: finalValue },
            reason: reason || `Perbaikan kualitas data: ${field}`,
            requestId: ctx.requestId,
          });

          invalidateDataQualityCache();
          return successResponse(updated, { requestId: ctx.requestId });
        })
      )
    )
  );

  // POST /api/data-quality/ignore-candidate (Mark false positive fuzzy duplicate)
  router.post(
    '/api/data-quality/ignore-candidate',
    requireAuth(
      requirePermission(
        PERMISSIONS.DATA_QUALITY_MANAGE,
        validateBody(ignoreCandidateSchema, async (ctx, body) => {
          const db = getDb();
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          await db.insert(auditLogs).values({
            actorUserId: user.id,
            action: 'ignore_duplicate_candidate',
            entityType: 'person',
            entityId: body.personAId,
            beforeJson: { candidateA: body.personAId, candidateB: body.personBId },
            afterJson: { status: 'ignored', reason: body.reason },
            reason: body.reason,
            requestId: ctx.requestId,
          });

          invalidateDataQualityCache();
          return successResponse({ status: 'ignored', candidateA: body.personAId, candidateB: body.personBId }, { requestId: ctx.requestId });
        })
      )
    )
  );
}
