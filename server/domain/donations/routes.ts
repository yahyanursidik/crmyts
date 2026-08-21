import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { donations, donationPrograms, persons, personRoles, auditLogs } from '../../db/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';
import { defaultAttachmentService } from '../../storage/service';
import { sendDonationVerifiedReceiptEmail } from '../../email/service';

const createDonationSchema = z.object({
  personId: z.string().uuid('Jamaah / Donatur wajib dipilih'),
  programId: z.string().uuid('Program donasi wajib dipilih'),
  amountRupiah: z.number().int().positive('Nominal donasi harus lebih dari 0'),
  donationDate: z.string().min(1, 'Tanggal donasi wajib diisi'),
  paymentMethod: z.enum(['bank_transfer', 'qris', 'cash', 'other']).default('bank_transfer'),
  externalReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  proofAttachmentId: z.string().uuid().optional().nullable(),
});

const updateDonationSchema = z.object({
  programId: z.string().uuid().optional(),
  amountRupiah: z.number().int().positive().optional(),
  donationDate: z.string().optional(),
  paymentMethod: z.enum(['bank_transfer', 'qris', 'cash', 'other']).optional(),
  externalReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const verifyDonationSchema = z.object({
  reason: z.string().optional().nullable(),
});

const rejectDonationSchema = z.object({
  rejectionReason: z.string().min(3, 'Alasan penolakan wajib dicantumkan minimal 3 karakter'),
});

const needReviewDonationSchema = z.object({
  reason: z.string().min(3, 'Alasan perlu review khusus wajib dicantumkan'),
});

const correctDonationSchema = z.object({
  reason: z.string().min(5, 'Alasan koreksi transaksi terverifikasi wajib diisi lengkap (min. 5 karakter)'),
  amountRupiah: z.number().int().positive().optional(),
  programId: z.string().uuid().optional(),
  paymentMethod: z.enum(['bank_transfer', 'qris', 'cash', 'other']).optional(),
  externalReference: z.string().optional().nullable(),
});

export function registerDonationsRoutes(router: Router) {
  // GET /api/donation-programs
  router.get(
    '/api/donation-programs',
    requireAuth(async (ctx) => {
      const db = getDb();
      const programs = await db.query.donationPrograms.findMany({
        where: eq(donationPrograms.isActive, true),
        orderBy: [desc(donationPrograms.createdAt)],
      });
      return successResponse(programs, { requestId: ctx.requestId });
    })
  );

  // GET /api/donations (Paginated and Filtered Donation Records)
  router.get(
    '/api/donations',
    requireAuth(async (ctx) => {
      const db = getDb();

      const page = Math.max(1, parseInt(ctx.query.page || '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(ctx.query.pageSize || '15', 10)));
      const offset = (page - 1) * pageSize;

      const personId = ctx.query.personId?.trim();
      const programId = ctx.query.programId?.trim();
      const verificationStatus = ctx.query.verificationStatus?.trim();
      const paymentMethod = ctx.query.paymentMethod?.trim();

      const conditions = [];
      if (personId) conditions.push(eq(donations.personId, personId));
      if (programId) conditions.push(eq(donations.programId, programId));
      if (verificationStatus) conditions.push(eq(donations.verificationStatus, verificationStatus as any));
      if (paymentMethod) conditions.push(eq(donations.paymentMethod, paymentMethod as any));

      const combinedWhere = conditions.length > 0 ? and(...conditions) : undefined;

      // Count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(donations)
        .where(combinedWhere);

      const totalCount = countResult?.count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      const list = await db.query.donations.findMany({
        where: combinedWhere,
        orderBy: [desc(donations.donationDate)],
        limit: pageSize,
        offset,
        with: {
          person: {
            columns: {
              id: true,
              fullName: true,
              phoneE164: true,
              cityRegency: true,
              engagementStatus: true,
            },
          },
          program: true,
          verifier: {
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

      const formatted = list.map((d) => ({
        id: d.id,
        donationDate: d.donationDate,
        amountRupiah: Number(d.amountRupiah),
        paymentMethod: d.paymentMethod,
        externalReference: d.externalReference,
        verificationStatus: d.verificationStatus,
        proofAttachmentId: d.proofAttachmentId,
        hasProof: !!d.proofAttachmentId,
        rejectionReason: d.rejectionReason,
        verifiedAt: d.verifiedAt,
        correctionOfDonationId: d.correctionOfDonationId,
        createdAt: d.createdAt,
        person: d.person || null,
        program: d.program || null,
        verifier: d.verifier || null,
        creator: d.creator || null,
      }));

      return successResponse(formatted, {
        requestId: ctx.requestId,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
      });
    })
  );

  // GET /api/donors (Master Donatur - Aggregated Persons with role 'donatur')
  router.get(
    '/api/donors',
    requireAuth(async (ctx) => {
      const db = getDb();

      // Find all persons having role 'donatur'
      const donorPersonRoles = await db.query.personRoles.findMany({
        where: eq(personRoles.roleCode, 'donatur'),
      });

      const personIds = donorPersonRoles.map((r) => r.personId);

      if (personIds.length === 0) {
        return successResponse([], { requestId: ctx.requestId, total: 0 });
      }

      const donorPersons = await db.query.persons.findMany({
        where: inArray(persons.id, personIds),
        with: {
          owner: {
            columns: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      // Get all donations for these persons to compute verified sum and stats
      const donorDonations = await db.query.donations.findMany({
        where: inArray(donations.personId, personIds),
        orderBy: [desc(donations.donationDate)],
      });

      const statsMap = new Map<string, { totalVerified: number; count: number; lastDate: Date | null }>();
      for (const d of donorDonations) {
        if (!d.personId) continue;
        const current = statsMap.get(d.personId) || { totalVerified: 0, count: 0, lastDate: null };
        current.count += 1;
        if (d.verificationStatus === 'verified') {
          current.totalVerified += Number(d.amountRupiah);
        }
        if (!current.lastDate || d.donationDate > current.lastDate) {
          current.lastDate = d.donationDate;
        }
        statsMap.set(d.personId, current);
      }

      const formatted = donorPersons.map((p) => {
        const stats = statsMap.get(p.id) || { totalVerified: 0, count: 0, lastDate: null };
        return {
          id: p.id,
          fullName: p.fullName,
          phoneE164: p.phoneE164,
          email: p.email,
          cityRegency: p.cityRegency,
          engagementStatus: p.engagementStatus,
          owner: p.owner || null,
          totalVerifiedDonationsRupiah: stats.totalVerified,
          donationsCount: stats.count,
          lastDonationDate: stats.lastDate,
        };
      });

      // Sort by highest contribution
      formatted.sort((a, b) => b.totalVerifiedDonationsRupiah - a.totalVerifiedDonationsRupiah);

      return successResponse(formatted, { requestId: ctx.requestId, total: formatted.length });
    })
  );

  // POST /api/donations (Record Donation + Auto-assign donor role to person)
  router.post(
    '/api/donations',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_CREATE,
        validateBody(createDonationSchema, async (ctx, body) => {
          const db = getDb();
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          const result = await db.transaction(async (tx) => {
            // 1. Insert Donation with default status 'unverified'
            const [created] = await tx
              .insert(donations)
              .values({
                personId: body.personId,
                programId: body.programId,
                amountRupiah: BigInt(body.amountRupiah),
                donationDate: new Date(body.donationDate),
                paymentMethod: body.paymentMethod,
                externalReference: body.externalReference || null,
                proofAttachmentId: body.proofAttachmentId || null,
                verificationStatus: 'unverified',
                createdBy: user.id,
              })
              .returning();

            if (!created) {
              throw new Error('Gagal menyimpan transaksi donasi');
            }

            // 2. Ensure person has role 'donatur'
            const existingRole = await tx.query.personRoles.findFirst({
              where: and(
                eq(personRoles.personId, body.personId),
                eq(personRoles.roleCode, 'donatur')
              ),
            });

            if (!existingRole) {
              await tx.insert(personRoles).values({
                personId: body.personId,
                roleCode: 'donatur',
              });
            }

            return created;
          });

          return successResponse(
            { ...result, amountRupiah: Number(result.amountRupiah) },
            { requestId: ctx.requestId },
            201
          );
        })
      )
    )
  );

  // PUT /api/donations/:id (Generic update - BLOCKED if donation is already verified)
  router.put(
    '/api/donations/:id',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_CREATE,
        validateBody(updateDonationSchema, async (ctx, body) => {
          const db = getDb();
          const donationId = ctx.params.id;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          if (!donationId) {
            return errorResponse('VALIDATION_ERROR', 'ID Donasi diperlukan', 400, ctx.requestId);
          }

          const existing = await db.query.donations.findFirst({
            where: eq(donations.id, donationId),
          });

          if (!existing) {
            return errorResponse('NOT_FOUND', 'Donasi tidak ditemukan', 404, ctx.requestId);
          }

          // Rule: Verified donation TIDAK BOLEH diedit melalui generic update!
          if (existing.verificationStatus === 'verified') {
            return errorResponse(
              'VALIDATION_ERROR',
              'Donasi yang sudah terverifikasi sah tidak dapat diubah melalui edit biasa. Gunakan alur koreksi donasi khusus.',
              422,
              ctx.requestId
            );
          }

          const [updated] = await db
            .update(donations)
            .set({
              ...(body.programId && { programId: body.programId }),
              ...(body.amountRupiah && { amountRupiah: BigInt(body.amountRupiah) }),
              ...(body.donationDate && { donationDate: new Date(body.donationDate) }),
              ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
              ...(body.externalReference !== undefined && { externalReference: body.externalReference }),
              updatedAt: new Date(),
            })
            .where(eq(donations.id, donationId))
            .returning();

          if (!updated) {
            return errorResponse('NOT_FOUND', 'Donasi tidak ditemukan', 404, ctx.requestId);
          }

          return successResponse(
            { ...updated, amountRupiah: Number(updated.amountRupiah) },
            { requestId: ctx.requestId }
          );
        })
      )
    )
  );

  // POST /api/donations/:id/verify (8-Step Atomic Verification Flow)
  router.post(
    '/api/donations/:id/verify',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_VERIFY,
        validateBody(verifyDonationSchema, async (ctx, body) => {
          const db = getDb();
          const donationId = ctx.params.id;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          if (!donationId) {
            return errorResponse('VALIDATION_ERROR', 'ID Donasi diperlukan', 400, ctx.requestId);
          }

          // 8-Step Transactional Verification Flow
          const verifiedDonation = await db.transaction(async (tx) => {
            // Step 2: Read current donation
            const current = await tx.query.donations.findFirst({
              where: eq(donations.id, donationId),
            });

            if (!current) {
              throw new Error('NOT_FOUND: Data donasi tidak ditemukan');
            }

            // Step 3: Validate current state
            if (current.verificationStatus === 'verified') {
              throw new Error('ALREADY_VERIFIED: Transaksi ini sudah berstatus sah terverifikasi');
            }

            const beforeState = {
              verificationStatus: current.verificationStatus,
              amountRupiah: Number(current.amountRupiah),
              programId: current.programId,
              paymentMethod: current.paymentMethod,
              externalReference: current.externalReference,
            };

            const now = new Date();

            // Step 4, 5, 6: Update status, set verified_by, set verified_at
            const [updated] = await tx
              .update(donations)
              .set({
                verificationStatus: 'verified',
                verifiedBy: user.id,
                verifiedAt: now,
                rejectionReason: null,
                updatedAt: now,
              })
              .where(eq(donations.id, donationId))
              .returning();

            if (!updated) {
              throw new Error('Gagal memperbarui status verifikasi donasi');
            }

            const afterState = {
              verificationStatus: 'verified',
              amountRupiah: Number(updated.amountRupiah),
              verifiedBy: user.id,
              verifiedAt: now.toISOString(),
            };

            // Step 7: Audit before / after
            await tx.insert(auditLogs).values({
              actorUserId: user.id,
              action: 'verify_donation',
              entityType: 'donation',
              entityId: updated.id,
              beforeJson: beforeState,
              afterJson: afterState,
              reason: body.reason || 'Verifikasi sah oleh Finance Verifier',
              requestId: ctx.requestId,
            });

            // Step 8: Commit (handled by Drizzle transaction)
            return updated;
          });

          // Asynchronously dispatch official verification receipt email if person has email
          if (db.query?.donations?.findFirst) {
            db.query.donations
              .findFirst({
                where: eq(donations.id, verifiedDonation.id),
                with: {
                  person: true,
                  program: true,
                },
              })
              .then((d) => {
                if (d?.person?.email) {
                  sendDonationVerifiedReceiptEmail({
                    recipientEmail: d.person.email,
                    donorName: d.person.fullName,
                    programName: d.program?.name || 'Infaq Dakwah Sunnah',
                    amountRupiah: Number(verifiedDonation.amountRupiah),
                    receiptNumber: `KWT-YTS-${new Date().getFullYear()}-${verifiedDonation.id.slice(0, 8).toUpperCase()}`,
                    verifiedAtFormatted: new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }),
                  }).catch((err) => console.warn('[Email Receipt Error]:', err));
                }
              })
              .catch((err) => console.warn('[Email Receipt Lookup Error]:', err));
          }

          return successResponse(
            { ...verifiedDonation, amountRupiah: Number(verifiedDonation.amountRupiah) },
            { requestId: ctx.requestId }
          );
        })
      )
    )
  );

  // POST /api/donations/:id/reject (Transactional Rejection Flow with Audit)
  router.post(
    '/api/donations/:id/reject',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_VERIFY,
        validateBody(rejectDonationSchema, async (ctx, body) => {
          const db = getDb();
          const donationId = ctx.params.id;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          if (!donationId) {
            return errorResponse('VALIDATION_ERROR', 'ID Donasi diperlukan', 400, ctx.requestId);
          }

          const rejectedDonation = await db.transaction(async (tx) => {
            const current = await tx.query.donations.findFirst({
              where: eq(donations.id, donationId),
            });

            if (!current) {
              throw new Error('NOT_FOUND: Data donasi tidak ditemukan');
            }

            if (current.verificationStatus === 'verified') {
              throw new Error('CANNOT_REJECT_VERIFIED: Donasi yang sudah sah terverifikasi tidak dapat ditolak langsung. Gunakan koreksi transaksi.');
            }

            const beforeState = {
              verificationStatus: current.verificationStatus,
              amountRupiah: Number(current.amountRupiah),
            };

            const now = new Date();

            const [updated] = await tx
              .update(donations)
              .set({
                verificationStatus: 'rejected',
                rejectionReason: body.rejectionReason,
                verifiedBy: user.id,
                verifiedAt: now,
                updatedAt: now,
              })
              .where(eq(donations.id, donationId))
              .returning();

            if (!updated) {
              throw new Error('Gagal memperbarui status penolakan');
            }

            // Audit
            await tx.insert(auditLogs).values({
              actorUserId: user.id,
              action: 'reject_donation',
              entityType: 'donation',
              entityId: updated.id,
              beforeJson: beforeState,
              afterJson: {
                verificationStatus: 'rejected',
                rejectionReason: body.rejectionReason,
                rejectedBy: user.id,
              },
              reason: body.rejectionReason,
              requestId: ctx.requestId,
            });

            return updated;
          });

          return successResponse(
            { ...rejectedDonation, amountRupiah: Number(rejectedDonation.amountRupiah) },
            { requestId: ctx.requestId }
          );
        })
      )
    )
  );

  // POST /api/donations/:id/need-review (Transactional Need Review with Audit)
  router.post(
    '/api/donations/:id/need-review',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_VERIFY,
        validateBody(needReviewDonationSchema, async (ctx, body) => {
          const db = getDb();
          const donationId = ctx.params.id;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
          if (!donationId) return errorResponse('VALIDATION_ERROR', 'ID Donasi diperlukan', 400, ctx.requestId);

          const result = await db.transaction(async (tx) => {
            const current = await tx.query.donations.findFirst({
              where: eq(donations.id, donationId),
            });

            if (!current) throw new Error('NOT_FOUND: Donasi tidak ditemukan');

            const now = new Date();
            const [updated] = await tx
              .update(donations)
              .set({
                verificationStatus: 'need_review',
                rejectionReason: body.reason,
                updatedAt: now,
              })
              .where(eq(donations.id, donationId))
              .returning();

            if (!updated) {
              throw new Error('NOT_FOUND: Gagal memperbarui donasi');
            }

            await tx.insert(auditLogs).values({
              actorUserId: user.id,
              action: 'need_review_donation',
              entityType: 'donation',
              entityId: updated.id,
              beforeJson: { verificationStatus: current.verificationStatus },
              afterJson: { verificationStatus: 'need_review', reason: body.reason },
              reason: body.reason,
              requestId: ctx.requestId,
            });

            return updated;
          });

          if (!result) {
            return errorResponse('INTERNAL_ERROR', 'Gagal memperbarui donasi', 500, ctx.requestId);
          }

          return successResponse(
            { ...result, amountRupiah: Number(result.amountRupiah) },
            { requestId: ctx.requestId }
          );
        })
      )
    )
  );

  // POST /api/donations/:id/correction (Dedicated Correction Flow for Verified Donations)
  router.post(
    '/api/donations/:id/correction',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_CORRECT_VERIFIED,
        validateBody(correctDonationSchema, async (ctx, body) => {
          const db = getDb();
          const originalDonationId = ctx.params.id;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          if (!originalDonationId) {
            return errorResponse('VALIDATION_ERROR', 'ID Donasi diperlukan', 400, ctx.requestId);
          }

          const correctionResult = await db.transaction(async (tx) => {
            const original = await tx.query.donations.findFirst({
              where: eq(donations.id, originalDonationId),
            });

            if (!original) {
              throw new Error('NOT_FOUND: Donasi asli tidak ditemukan');
            }

            if (original.verificationStatus !== 'verified') {
              throw new Error('VALIDATION_ERROR: Alur koreksi khusus ini hanya berlaku untuk donasi yang sudah terverifikasi sah');
            }

            const now = new Date();

            // 1. Update original donation with correction adjustments
            const beforeJson = {
              amountRupiah: Number(original.amountRupiah),
              programId: original.programId,
              paymentMethod: original.paymentMethod,
              externalReference: original.externalReference,
            };

            const [updatedOriginal] = await tx
              .update(donations)
              .set({
                ...(body.amountRupiah && { amountRupiah: BigInt(body.amountRupiah) }),
                ...(body.programId && { programId: body.programId }),
                ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
                ...(body.externalReference !== undefined && { externalReference: body.externalReference }),
                rejectionReason: `Koreksi: ${body.reason}`,
                updatedAt: now,
              })
              .where(eq(donations.id, originalDonationId))
              .returning();

            if (!updatedOriginal) {
              throw new Error('INTERNAL_ERROR: Gagal memperbarui donasi koreksi');
            }

            const afterJson = {
              amountRupiah: Number(updatedOriginal.amountRupiah),
              programId: updatedOriginal.programId,
              paymentMethod: updatedOriginal.paymentMethod,
              externalReference: updatedOriginal.externalReference,
              correctionReason: body.reason,
            };

            // 2. Audit Trail for Financial Correction
            await tx.insert(auditLogs).values({
              actorUserId: user.id,
              action: 'correct_verified_donation',
              entityType: 'donation',
              entityId: original.id,
              beforeJson,
              afterJson,
              reason: body.reason,
              requestId: ctx.requestId,
            });

            return updatedOriginal;
          });

          if (!correctionResult) {
            return errorResponse('INTERNAL_ERROR', 'Gagal memproses koreksi donasi', 500, ctx.requestId);
          }

          return successResponse(
            { ...correctionResult, amountRupiah: Number(correctionResult.amountRupiah) },
            { requestId: ctx.requestId }
          );
        })
      )
    )
  );

  // GET /api/donations/:id/proof (Private, Secure Access to Transfer Proof)
  router.get(
    '/api/donations/:id/proof',
    requireAuth(
      requirePermission(PERMISSIONS.DONATIONS_LIST, async (ctx) => {
        const db = getDb();
        const donationId = ctx.params.id;

        if (!donationId) {
          return errorResponse('VALIDATION_ERROR', 'ID Donasi diperlukan', 400, ctx.requestId);
        }

        const donation = await db.query.donations.findFirst({
          where: eq(donations.id, donationId),
          with: {
            person: true,
            program: true,
          },
        });

        if (!donation) {
          return errorResponse('NOT_FOUND', 'Donasi tidak ditemukan', 404, ctx.requestId);
        }

        let temporaryUrl: string | null = null;
        let attachmentMeta: any = null;

        if (donation.proofAttachmentId && ctx.user) {
          try {
            const result = await defaultAttachmentService.getTemporaryUrl(donation.proofAttachmentId, {
              requestingUserId: ctx.user.id,
              expiresInSeconds: 900,
              requestId: ctx.requestId,
            });
            temporaryUrl = result.url;
            attachmentMeta = result.metadata;
          } catch {
            // attachment might not exist in mock, fallback cleanly
          }
        }

        // Return private secure proof metadata / authenticated preview URL
        return successResponse(
          {
            donationId: donation.id,
            personName: donation.person?.fullName || 'Anonim',
            amountRupiah: Number(donation.amountRupiah),
            externalReference: donation.externalReference,
            proofAttachmentId: donation.proofAttachmentId,
            isPrivate: true,
            storageProvider: attachmentMeta?.storageProvider || 's3_contabo',
            mimeType: attachmentMeta?.mimeType || 'image/jpeg',
            temporaryUrl,
            message: 'Akses bukti transfer terproteksi oleh otentikasi internal YTS',
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );
}
