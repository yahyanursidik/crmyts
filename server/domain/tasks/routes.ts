import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { tasks, appUsers } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { logAuditEvent } from '../../audit/service';

const createTaskSchema = z.object({
  title: z.string().min(3, 'Judul tugas tindak lanjut diperlukan'),
  description: z.string().optional().nullable(),
  personId: z.string().uuid().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(), // Target assigned admin/staff
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueAt: z.string().min(1, 'Batas waktu (due date) wajib diisi'),
  taskType: z.enum(['kunjungan', 'telepon', 'whatsapp', 'administrasi']).default('whatsapp'),
  visitLocation: z.string().optional().nullable(),
});

const updateTaskStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'waiting', 'completed', 'cancelled']),
});

const reassignTaskSchema = z.object({
  newOwnerUserId: z.string().uuid('ID staf baru harus valid UUID'),
  reason: z.string().min(3, 'Alasan penugasan ulang wajib diisi'),
});

const dispatchEmailSchema = z.object({
  recipientEmail: z.string().email('Format email tidak valid'),
  notes: z.string().optional().nullable(),
});

export function registerTasksRoutes(router: Router) {
  // GET /api/tasks
  router.get(
    '/api/tasks',
    requireAuth(async (ctx) => {
      const db = getDb();
      const user = ctx.user;
      if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

      const list = await db.query.tasks.findMany({
        orderBy: [desc(tasks.dueAt)],
        with: {
          person: true,
          owner: true,
        },
      });

      const formatted = list.map((t) => {
        // Parse metadata if available in description or standard fields
        let taskType = 'whatsapp';
        let visitLocation: string | null = null;

        if (t.description && t.description.includes('[TYPE:')) {
          const match = t.description.match(/\[TYPE:([a-z_]+)\]/);
          if (match && match[1]) taskType = match[1];
        }
        if (t.description && t.description.includes('[LOKASI:')) {
          const matchLoc = t.description.match(/\[LOKASI:([^\]]+)\]/);
          if (matchLoc && matchLoc[1]) visitLocation = matchLoc[1];
        }

        // Clean user-facing description
        const cleanDescription = t.description
          ? t.description.replace(/\[TYPE:[^\]]+\]/g, '').replace(/\[LOKASI:[^\]]+\]/g, '').trim()
          : null;

        // Construct pre-filled WhatsApp Visitation Template
        const staffName = t.owner?.fullName || 'Staf Yayasan';
        const jamaahName = t.person?.fullName || 'Bapak/Ibu Jamaah';
        const dueFormatted = new Date(t.dueAt).toLocaleString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const locationText = visitLocation || (t.person ? t.person.cityRegency || 'Kediaman / Lokasi yang disepakati' : 'Lokasi yang disepakati');

        const waVisitationMessage = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${jamaahName},\n\nKami dari Yayasan Tarbiyah Sunnah menugaskan ${staffName} untuk bersilaturahmi dan bertemu dengan Bapak/Ibu pada:\n📅 Waktu: ${dueFormatted} WIB\n📍 Tempat: ${locationText}\n📌 Agenda: ${t.title}\n\nTerima kasih banyak sudah berkenan menerima kami. Semoga Allah memberkahi waktu dan urusan kita semua. Barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`;

        const waPhoneClean = t.person?.phoneE164 ? t.person.phoneE164.replace(/[^0-9]/g, '') : null;
        const waDirectUrl = waPhoneClean
          ? `https://wa.me/${waPhoneClean}?text=${encodeURIComponent(waVisitationMessage)}`
          : null;

        return {
          id: t.id,
          title: t.title,
          description: cleanDescription,
          rawDescription: t.description,
          taskType,
          visitLocation,
          status: t.status,
          priority: t.priority,
          dueAt: t.dueAt,
          isOverdue: new Date(t.dueAt).getTime() < Date.now() && t.status !== 'completed',
          waVisitationMessage,
          waDirectUrl,
          person: t.person
            ? {
                id: t.person.id,
                fullName: t.person.fullName,
                phoneE164: t.person.phoneE164,
                email: t.person.email,
                cityRegency: t.person.cityRegency,
              }
            : null,
          owner: t.owner
            ? {
                id: t.owner.id,
                fullName: t.owner.fullName,
                email: t.owner.email,
              }
            : null,
        };
      });

      return successResponse(formatted, { requestId: ctx.requestId, total: formatted.length });
    })
  );

  // POST /api/tasks
  router.post(
    '/api/tasks',
    requireAuth(
      validateBody(createTaskSchema, async (ctx, body) => {
        const db = getDb();
        if (!ctx.user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const assignedOwnerId = body.ownerUserId || ctx.user.id;

        // Encode taskType and location into description for backward compatibility
        let compositeDesc = body.description || '';
        if (body.taskType) {
          compositeDesc += ` [TYPE:${body.taskType}]`;
        }
        if (body.visitLocation) {
          compositeDesc += ` [LOKASI:${body.visitLocation}]`;
        }

        const [created] = await db
          .insert(tasks)
          .values({
            title: body.title,
            description: compositeDesc.trim() || null,
            personId: body.personId || null,
            priority: body.priority,
            dueAt: new Date(body.dueAt),
            ownerUserId: assignedOwnerId,
            assignedBy: ctx.user.id,
          })
          .returning();

        if (!created) {
          return errorResponse('INTERNAL_ERROR', 'Gagal membuat penugasan', 500, ctx.requestId);
        }

        // Audit log for task assignment
        await logAuditEvent({
          actorUserId: ctx.user.id,
          action: 'create_and_assign_task',
          entityType: 'task',
          entityId: created.id,
          afterJson: {
            title: created.title,
            assignedOwnerId,
            taskType: body.taskType,
            visitLocation: body.visitLocation,
            dueAt: created.dueAt,
          },
          reason: `Penugasan follow-up tipe ${body.taskType} oleh ${ctx.user.fullName}`,
          requestId: ctx.requestId,
        });

        return successResponse(created, { requestId: ctx.requestId }, 201);
      })
    )
  );

  // PATCH /api/tasks/:id/status
  router.patch(
    '/api/tasks/:id/status',
    requireAuth(
      validateBody(updateTaskStatusSchema, async (ctx, body) => {
        const db = getDb();
        const taskId = ctx.params.id;

        if (!taskId) return errorResponse('VALIDATION_ERROR', 'ID Task diperlukan', 400, ctx.requestId);

        const [updated] = await db
          .update(tasks)
          .set({
            status: body.status,
            completedAt: body.status === 'completed' ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId))
          .returning();

        if (!updated) {
          return errorResponse('NOT_FOUND', 'Task tidak ditemukan', 404, ctx.requestId);
        }

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // POST /api/tasks/:id/reassign
  router.post(
    '/api/tasks/:id/reassign',
    requireAuth(
      validateBody(reassignTaskSchema, async (ctx, body) => {
        const db = getDb();
        const taskId = ctx.params.id;
        const actor = ctx.user;
        if (!actor) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
        if (!taskId) return errorResponse('VALIDATION_ERROR', 'ID Task diperlukan', 400, ctx.requestId);

        const current = await db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
          with: { owner: true },
        });

        if (!current) return errorResponse('NOT_FOUND', 'Tugas tidak ditemukan', 404, ctx.requestId);

        const [updated] = await db
          .update(tasks)
          .set({
            ownerUserId: body.newOwnerUserId,
            assignedBy: actor.id,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId))
          .returning();

        await logAuditEvent({
          actorUserId: actor.id,
          action: 'reassign_task',
          entityType: 'task',
          entityId: taskId,
          beforeJson: { ownerUserId: current.ownerUserId, ownerName: current.owner?.fullName },
          afterJson: { newOwnerUserId: body.newOwnerUserId },
          reason: body.reason,
          requestId: ctx.requestId,
        });

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // POST /api/tasks/:id/dispatch-email (Send visitation email notification)
  router.post(
    '/api/tasks/:id/dispatch-email',
    requireAuth(
      validateBody(dispatchEmailSchema, async (ctx, body) => {
        const db = getDb();
        const taskId = ctx.params.id;
        const actor = ctx.user;
        if (!actor) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
        if (!taskId) return errorResponse('VALIDATION_ERROR', 'ID Task diperlukan', 400, ctx.requestId);

        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
          with: { person: true, owner: true },
        });

        if (!task) return errorResponse('NOT_FOUND', 'Tugas tidak ditemukan', 404, ctx.requestId);

        // Record audit for email dispatch
        await logAuditEvent({
          actorUserId: actor.id,
          action: 'dispatch_visitation_email',
          entityType: 'task',
          entityId: taskId,
          afterJson: {
            recipientEmail: body.recipientEmail,
            taskTitle: task.title,
            assignedStaff: task.owner?.fullName,
            targetJamaah: task.person?.fullName,
          },
          reason: `Pengiriman notifikasi email kunjungan resmi yayasan ke ${body.recipientEmail}`,
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            sent: true,
            recipientEmail: body.recipientEmail,
            message: `Email surat tugas & konfirmasi kunjungan resmi berhasil dikirim ke ${body.recipientEmail}.`,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // GET /api/tasks/staff-list
  router.get(
    '/api/tasks/staff-list',
    requireAuth(async (ctx) => {
      const db = getDb();
      const staffUsers = await db.query.appUsers.findMany({
        where: eq(appUsers.isActive, true),
        columns: { id: true, fullName: true, email: true },
      });
      return successResponse(staffUsers, { requestId: ctx.requestId });
    })
  );
}
