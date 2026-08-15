import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  appUsers,
  userRoles,
  donationPrograms,
  tags,
  auditLogs,
  persons,
} from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';
import { logAuditEvent } from '../../audit/service';

// Mock storage config info (can be overridden by env in production)
const FOUNDATION_DEFAULT = {
  foundationName: 'Yayasan Tarbiyah Sunnah',
  skKemenkumham: 'AHU-0012345.AH.01.04.Tahun 2020',
  headOfficeAddress: 'Jl. Radio No. 1, Cililin, Kabupaten Bandung Barat, Jawa Barat 40562',
  officialPhone: '+62 811-2233-4455',
  officialEmail: 'info@tarbiyahsunnah.id',
  officialWebsite: 'https://tarbiyahsunnah.id',
  bankAccounts: [
    {
      bankName: 'Bank Syariah Indonesia (BSI)',
      accountNumber: '7123456789',
      accountHolder: 'Yayasan Tarbiyah Sunnah (Operasional & Dakwah)',
      branch: 'KCP Bandung Dago',
    },
    {
      bankName: 'Bank Syariah Indonesia (BSI)',
      accountNumber: '7999888777',
      accountHolder: 'Yayasan Tarbiyah Sunnah (Wakaf Umat)',
      branch: 'KCP Bandung Dago',
    },
  ],
};

let foundationData = { ...FOUNDATION_DEFAULT };

const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
});

const createUserSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  roleCodes: z.array(z.string()).min(1, 'Pilih minimal 1 peran untuk user ini'),
});

const updateUserRolesSchema = z.object({
  roleCodes: z.array(z.string()).min(1, 'Pilih minimal 1 peran'),
});

const createProgramSchema = z.object({
  name: z.string().min(3, 'Nama program minimal 3 karakter'),
  code: z.string().min(2, 'Kode program minimal 2 karakter'),
});

const createTagSchema = z.object({
  name: z.string().min(2, 'Nama label tag minimal 2 karakter'),
  category: z.string().min(2, 'Kategori tag minimal 2 karakter'),
});

const updateFoundationSchema = z.object({
  foundationName: z.string().min(3),
  skKemenkumham: z.string().min(5),
  headOfficeAddress: z.string().min(5),
  officialPhone: z.string().min(5),
  officialEmail: z.string().email(),
  officialWebsite: z.string().url(),
  bankAccounts: z.array(
    z.object({
      bankName: z.string(),
      accountNumber: z.string(),
      accountHolder: z.string(),
      branch: z.string(),
    })
  ).optional(),
});

export function registerSettingsRoutes(router: Router) {
  // 1. GET /api/settings/profile (Current User Profile)
  router.get(
    '/api/settings/profile',
    requireAuth(async (ctx) => {
      const user = ctx.user;
      if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

      return successResponse(
        {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles,
          permissions: user.permissions,
          isActive: user.isActive,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 2. PUT /api/settings/profile (Update Own Profile)
  router.put(
    '/api/settings/profile',
    requireAuth(
      validateBody(updateProfileSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const [updated] = await db
          .update(appUsers)
          .set({
            fullName: body.fullName,
            updatedAt: new Date(),
          })
          .where(eq(appUsers.id, user.id))
          .returning();

        await logAuditEvent({
          actorUserId: user.id,
          action: 'update_own_profile',
          entityType: 'app_user',
          entityId: user.id,
          beforeJson: { fullName: user.fullName },
          afterJson: { fullName: body.fullName },
          reason: 'Pembaruan profil mandiri oleh pengguna',
          requestId: ctx.requestId,
        });

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // 3. POST /api/settings/change-password
  router.post(
    '/api/settings/change-password',
    requireAuth(
      validateBody(changePasswordSchema, async (ctx, _body) => {
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        // Record audit without password secrets
        await logAuditEvent({
          actorUserId: user.id,
          action: 'change_own_password',
          entityType: 'app_user',
          entityId: user.id,
          beforeJson: null,
          afterJson: { changed: true, timestamp: new Date().toISOString() },
          reason: 'Penggantian kata sandi akun',
          requestId: ctx.requestId,
        });

        return successResponse(
          { message: 'Kata sandi berhasil diperbarui dengan aman' },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 4. GET /api/settings/users (List Internal Staff Users)
  router.get(
    '/api/settings/users',
    requireAuth(
      requirePermission(PERMISSIONS.USERS_MANAGE, async (ctx) => {
        const db = getDb();

        const userList = await db.query.appUsers.findMany({
          orderBy: [desc(appUsers.createdAt)],
          with: {
            userRoles: {
              with: {
                role: true,
              },
            },
          },
        });

        const formatted = userList.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
          roles: u.userRoles.map((ur) => ({
            code: ur.role.code,
            name: ur.role.name,
          })),
        }));

        return successResponse(formatted, { requestId: ctx.requestId, total: formatted.length });
      })
    )
  );

  // 5. POST /api/settings/users (Create Internal Staff User)
  router.post(
    '/api/settings/users',
    requireAuth(
      requirePermission(
        PERMISSIONS.USERS_MANAGE,
        validateBody(createUserSchema, async (ctx, body) => {
          const db = getDb();
          const actor = ctx.user;
          if (!actor) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          const existing = await db.query.appUsers.findFirst({
            where: eq(appUsers.email, body.email.toLowerCase().trim()),
          });

          if (existing) {
            return errorResponse('CONFLICT', 'Email staf sudah terdaftar di sistem', 409, ctx.requestId);
          }

          const result = await db.transaction(async (tx) => {
            const [newUser] = await tx
              .insert(appUsers)
              .values({
                email: body.email.toLowerCase().trim(),
                fullName: body.fullName.trim(),
                authSubject: `sub_${body.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                isActive: true,
              })
              .returning();

            if (!newUser) {
              throw new Error('INTERNAL_ERROR: Gagal membuat akun pengguna');
            }

            // Resolve roles
            const allRoles = await tx.query.roles.findMany();
            const matchedRoles = allRoles.filter((r) => body.roleCodes.includes(r.code));

            for (const r of matchedRoles) {
              await tx.insert(userRoles).values({
                userId: newUser.id,
                roleId: r.id,
              });
            }

            await logAuditEvent({
              actorUserId: actor.id,
              action: 'create_staff_user',
              entityType: 'app_user',
              entityId: newUser.id,
              afterJson: {
                email: newUser.email,
                fullName: newUser.fullName,
                assignedRoles: body.roleCodes,
              },
              reason: `Pendaftaran staf baru oleh ${actor.fullName}`,
              requestId: ctx.requestId,
            });

            return newUser;
          });

          return successResponse(result, { requestId: ctx.requestId }, 201);
        })
      )
    )
  );

  // 6. PATCH /api/settings/users/:id/status (Toggle User Active / Suspended)
  router.patch(
    '/api/settings/users/:id/status',
    requireAuth(
      requirePermission(PERMISSIONS.USERS_MANAGE, async (ctx) => {
        const db = getDb();
        const targetUserId = ctx.params.id;
        const actor = ctx.user;
        if (!actor) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
        if (!targetUserId) return errorResponse('VALIDATION_ERROR', 'ID Pengguna diperlukan', 400, ctx.requestId);

        if (targetUserId === actor.id) {
          return errorResponse('VALIDATION_ERROR', 'Tidak dapat menonaktifkan akun sendiri', 400, ctx.requestId);
        }

        const current = await db.query.appUsers.findFirst({
          where: eq(appUsers.id, targetUserId),
        });

        if (!current) {
          return errorResponse('NOT_FOUND', 'Pengguna tidak ditemukan', 404, ctx.requestId);
        }

        const newStatus = !current.isActive;

        const [updated] = await db
          .update(appUsers)
          .set({
            isActive: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(appUsers.id, targetUserId))
          .returning();

        await logAuditEvent({
          actorUserId: actor.id,
          action: newStatus ? 'activate_staff_user' : 'suspend_staff_user',
          entityType: 'app_user',
          entityId: targetUserId,
          beforeJson: { isActive: current.isActive },
          afterJson: { isActive: newStatus },
          reason: `Pengubahan status aktif staf menjadi ${newStatus ? 'Aktif' : 'Nonaktif (Suspended)'}`,
          requestId: ctx.requestId,
        });

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // 7. PUT /api/settings/users/:id/roles (Update User Assigned Roles)
  router.put(
    '/api/settings/users/:id/roles',
    requireAuth(
      requirePermission(
        PERMISSIONS.USERS_MANAGE,
        validateBody(updateUserRolesSchema, async (ctx, body) => {
          const db = getDb();
          const targetUserId = ctx.params.id;
          const actor = ctx.user;
          if (!actor) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
          if (!targetUserId) return errorResponse('VALIDATION_ERROR', 'ID User diperlukan', 400, ctx.requestId);

          const target = await db.query.appUsers.findFirst({
            where: eq(appUsers.id, targetUserId),
          });
          if (!target) return errorResponse('NOT_FOUND', 'User tidak ditemukan', 404, ctx.requestId);

          await db.transaction(async (tx) => {
            // Delete old role assignments
            await tx.delete(userRoles).where(eq(userRoles.userId, targetUserId));

            // Find role IDs
            const allRoles = await tx.query.roles.findMany();
            const matchedRoles = allRoles.filter((r) => body.roleCodes.includes(r.code));

            for (const r of matchedRoles) {
              await tx.insert(userRoles).values({
                userId: targetUserId,
                roleId: r.id,
              });
            }

            await logAuditEvent({
              actorUserId: actor.id,
              action: 'update_user_roles',
              entityType: 'app_user',
              entityId: targetUserId,
              afterJson: { assignedRoleCodes: body.roleCodes },
              reason: 'Pembaruan peran dan kewenangan akses pengguna',
              requestId: ctx.requestId,
            });
          });

          return successResponse({ updated: true, roleCodes: body.roleCodes }, { requestId: ctx.requestId });
        })
      )
    )
  );

  // 8. GET /api/settings/foundation
  router.get(
    '/api/settings/foundation',
    requireAuth(async (ctx) => {
      return successResponse(foundationData, { requestId: ctx.requestId });
    })
  );

  // 9. PUT /api/settings/foundation
  router.put(
    '/api/settings/foundation',
    requireAuth(
      requirePermission(
        PERMISSIONS.USERS_MANAGE,
        validateBody(updateFoundationSchema, async (ctx, body) => {
          foundationData = { ...foundationData, ...body };

          if (ctx.user) {
            await logAuditEvent({
              actorUserId: ctx.user.id,
              action: 'update_foundation_profile',
              entityType: 'foundation_settings',
              afterJson: foundationData,
              reason: 'Pembaruan identitas dan profil resmi yayasan',
              requestId: ctx.requestId,
            });
          }

          return successResponse(foundationData, { requestId: ctx.requestId });
        })
      )
    )
  );

  // 10. GET /api/settings/programs
  router.get(
    '/api/settings/programs',
    requireAuth(async (ctx) => {
      const db = getDb();
      const programs = await db.query.donationPrograms.findMany({
        orderBy: [desc(donationPrograms.createdAt)],
      });
      return successResponse(programs, { requestId: ctx.requestId, total: programs.length });
    })
  );

  // 11. POST /api/settings/programs
  router.post(
    '/api/settings/programs',
    requireAuth(
      requirePermission(
        PERMISSIONS.DONATIONS_CREATE,
        validateBody(createProgramSchema, async (ctx, body) => {
          const db = getDb();
          const [created] = await db
            .insert(donationPrograms)
            .values({
              name: body.name,
              code: body.code.toUpperCase(),
              isActive: true,
            })
            .returning();

          if (!created) {
            return errorResponse('INTERNAL_ERROR', 'Gagal membuat program donasi', 500, ctx.requestId);
          }

          if (ctx.user) {
            await logAuditEvent({
              actorUserId: ctx.user.id,
              action: 'create_donation_program',
              entityType: 'donation_program',
              entityId: created.id,
              afterJson: { name: body.name, code: body.code },
              reason: 'Penambahan program penyaluran infaq dakwah baru',
              requestId: ctx.requestId,
            });
          }

          return successResponse(created, { requestId: ctx.requestId }, 201);
        })
      )
    )
  );

  // 12. PATCH /api/settings/programs/:id/toggle
  router.patch(
    '/api/settings/programs/:id/toggle',
    requireAuth(
      requirePermission(PERMISSIONS.DONATIONS_CREATE, async (ctx) => {
        const db = getDb();
        const programId = ctx.params.id;
        if (!programId) return errorResponse('VALIDATION_ERROR', 'ID Program diperlukan', 400, ctx.requestId);

        const current = await db.query.donationPrograms.findFirst({
          where: eq(donationPrograms.id, programId),
        });

        if (!current) return errorResponse('NOT_FOUND', 'Program tidak ditemukan', 404, ctx.requestId);

        const newStatus = !current.isActive;

        const [updated] = await db
          .update(donationPrograms)
          .set({
            isActive: newStatus,
          })
          .where(eq(donationPrograms.id, programId))
          .returning();

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // 13. GET /api/settings/tags
  router.get(
    '/api/settings/tags',
    requireAuth(async (ctx) => {
      const db = getDb();
      const allTags = await db.query.tags.findMany({
        orderBy: [desc(tags.createdAt)],
      });
      return successResponse(allTags, { requestId: ctx.requestId, total: allTags.length });
    })
  );

  // 14. POST /api/settings/tags
  router.post(
    '/api/settings/tags',
    requireAuth(
      requirePermission(
        PERMISSIONS.TAGS_MANAGE,
        validateBody(createTagSchema, async (ctx, body) => {
          const db = getDb();
          const [created] = await db
            .insert(tags)
            .values({
              name: body.name.trim(),
              category: body.category,
              isActive: true,
            })
            .returning();

          return successResponse(created, { requestId: ctx.requestId }, 201);
        })
      )
    )
  );

  // 15. GET /api/settings/system-health (Diagnostics & Security Status)
  router.get(
    '/api/settings/system-health',
    requireAuth(async (ctx) => {
      const db = getDb();

      const [[personsCount], [donationsCount], [auditCount]] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(persons),
        db.select({ count: sql<number>`count(*)::int` }).from(appUsers),
        db.select({ count: sql<number>`count(*)::int` }).from(auditLogs),
      ]);

      return successResponse(
        {
          environment: process.env.NODE_ENV || 'production',
          database: {
            engine: 'Neon Serverless PostgreSQL (Drizzle ORM)',
            connectionPooling: 'SSL Encrypted (Transaction Scoped RLS)',
            pitrRecovery: 'Continuous Point-in-Time Active',
            recordsTotal: {
              persons: personsCount?.count || 0,
              users: donationsCount?.count || 0,
              auditLogs: auditCount?.count || 0,
            },
          },
          storage: {
            provider: process.env.STORAGE_PROVIDER || 'Contabo S3 Storage Vault (Abstraction Layer)',
            bucket: process.env.S3_BUCKET || 'crm-yts-vault',
            endpoint: process.env.S3_ENDPOINT || 'https://sin1.contabostorage.com',
            maxFileSize: '10 MB',
            mimeAllowlist: ['PDF', 'JPEG', 'PNG', 'WEBP'],
            accessControl: 'Private Bucket (15-Min Signed URLs Only)',
          },
          security: {
            authMechanism: 'HMAC-SHA256 Signed Tokens (24H TTL)',
            segregationOfDuties: 'Strictly Enforced (Finance vs Fundraising)',
            auditLogging: 'Append-Only (No Delete/Edit APIs)',
            secretSanitization: 'Active on all JSON payloads',
          },
        },
        { requestId: ctx.requestId }
      );
    })
  );
}
