import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { tasks, appUsers } from '../../db/schema';
import { eq, desc, and, sql, ilike, or, inArray, type SQL } from 'drizzle-orm';
import { logAuditEvent } from '../../audit/service';
import { PERMISSIONS, hasPermission } from '../../permissions/constants';
import { sendEmail, renderEmailLayout } from '../../email/service';

import {taskStatsCache} from './cache';
import {linkedInteractionTaskVisibility} from '../interactions/visibility';
import {moveInteractionTask,InteractionError,changeTaskStatus} from '../interactions/service';
import {moveRoomTask,RoomError} from '../jamaah-room/service';
const STATS_CACHE_TTL_MS = 60_000;

const createTaskSchema = z.object({
  title: z.string().min(3, 'Judul tugas tindak lanjut diperlukan'),
  description: z.string().optional().nullable(),
  personId: z.string().uuid().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(), // Target assigned admin/staff
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueAt: z.string().min(1, 'Batas waktu wajib diisi').refine((value) => Number.isFinite(Date.parse(value)), 'Batas waktu tidak valid.'),
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

      const viewAll = hasPermission(user.roles, PERMISSIONS.TASKS_VIEW_ALL);
      if (!viewAll && !hasPermission(user.roles, PERMISSIONS.TASKS_VIEW_OWN)) return errorResponse('FORBIDDEN', 'Izin melihat tugas diperlukan.', 403, ctx.requestId);
      if(ctx.query.roomEntryId&&!z.string().uuid().safeParse(ctx.query.roomEntryId).success)return errorResponse('VALIDATION_ERROR','ID pesan tidak valid.',400,ctx.requestId);
      const statsKey = `${viewAll ? 'all' : user.id}:${ctx.query.personId || 'all-people'}:${ctx.query.interactionId||'all-interactions'}:${ctx.query.roomEntryId||'all-room'}`;
      const cachedTasksStats = taskStatsCache.get(statsKey);
      const ownerScope = viewAll ? sql`true` : sql`owner_user_id = ${user.id}`;
      const personScope=ctx.query.personId?sql`${ownerScope} AND person_id=${ctx.query.personId}::uuid`:ownerScope;
      const sourceScope=ctx.query.interactionId?sql`${tasks.relatedType}='interaction' AND ${tasks.relatedId}=${ctx.query.interactionId}::uuid`:ctx.query.roomEntryId?sql`${tasks.relatedType}='jamaah_room_entry' AND ${tasks.relatedId}=${ctx.query.roomEntryId}::uuid`:sql`true`;
      const ownerFilter=sql`${personScope} AND ${sourceScope} AND ${linkedInteractionTaskVisibility(user.roles,user.id)}`;

      const page = ctx.query.page ? Math.max(1, parseInt(ctx.query.page, 10)) : 1;
      const pageSize = ctx.query.pageSize ? Math.min(100, Math.max(1, parseInt(ctx.query.pageSize, 10))) : (ctx.query.page ? 15 : undefined);
      const offset = pageSize ? (page - 1) * pageSize : undefined;

      const search = ctx.query.search?.trim();
      const status = ctx.query.status?.trim();
      const priority = ctx.query.priority?.trim();
      const ownerUserId = ctx.query.ownerUserId?.trim();
      const taskType = ctx.query.taskType?.trim();
      const isOverdue = ctx.query.isOverdue === 'true';

      const conditions: Array<SQL|undefined> = [linkedInteractionTaskVisibility(user.roles,user.id)];
      if(ctx.query.roomEntryId)conditions.push(eq(tasks.relatedType,'jamaah_room_entry'),eq(tasks.relatedId,ctx.query.roomEntryId));
      if(ctx.query.interactionId){
        if(!z.string().uuid().safeParse(ctx.query.interactionId).success)return errorResponse('VALIDATION_ERROR','ID interaksi tidak valid.',400,ctx.requestId);
        conditions.push(eq(tasks.relatedType,'interaction'),eq(tasks.relatedId,ctx.query.interactionId));
      }
      if (ctx.query.personId) {
        if (!z.string().uuid().safeParse(ctx.query.personId).success) return errorResponse('VALIDATION_ERROR', 'ID jamaah tidak valid.', 400, ctx.requestId);
        conditions.push(eq(tasks.personId, ctx.query.personId));
      }
      if (!viewAll) conditions.push(eq(tasks.ownerUserId, user.id));
      if (search) {
        conditions.push(
          or(
            ilike(tasks.title, `%${search}%`),
            ilike(tasks.description, `%${search}%`),
            sql`EXISTS (SELECT 1 FROM persons WHERE persons.id = ${tasks.personId} AND (persons.full_name ILIKE ${'%' + search + '%'} OR persons.phone_e164 ILIKE ${'%' + search + '%'}))`
          )
        );
      }
      if (status && status !== 'all') conditions.push(eq(tasks.status, status as any));
      if (priority && priority !== 'all') conditions.push(eq(tasks.priority, priority as any));
      if (ownerUserId && ownerUserId !== 'all') conditions.push(eq(tasks.ownerUserId, ownerUserId));
      if (taskType && taskType !== 'all') {
        conditions.push(ilike(tasks.description, `%[TYPE:${taskType}]%`));
      }
      if (isOverdue) {
        conditions.push(and(sql`${tasks.dueAt} < NOW()`, inArray(tasks.status, ['pending', 'in_progress', 'waiting'])));
      }

      const combinedWhere = conditions.length > 0 ? and(...conditions) : undefined;
      const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(tasks).where(combinedWhere);
      const totalCount = Number(countRow?.count || 0);

      const list = await db.query.tasks.findMany({
        where: combinedWhere,
        orderBy: [desc(tasks.dueAt)],
        limit: pageSize,
        offset: offset,
        with: {
          person: true,
          owner: true,
        },
      });

      // Calculate or fetch cached stats
      let stats = {
        totalAll: 0,
        pendingCount: 0,
        overdueCount: 0,
        completedCount: 0,
      };

      const nowTime = Date.now();
      if (cachedTasksStats && nowTime - cachedTasksStats.timestamp < STATS_CACHE_TTL_MS) {
        stats = cachedTasksStats.data;
      } else {
        try {
          const [statsRes] = await db
            .select({
              totalAll: sql<number>`(SELECT count(*)::int FROM "tasks" WHERE ${ownerFilter})`,
              pendingCount: sql<number>`(SELECT count(*)::int FROM "tasks" WHERE ${ownerFilter} AND "status" IN ('pending', 'in_progress', 'waiting'))`,
              overdueCount: sql<number>`(SELECT count(*)::int FROM "tasks" WHERE ${ownerFilter} AND "due_at" < NOW() AND "status" IN ('pending', 'in_progress', 'waiting'))`,
              completedCount: sql<number>`(SELECT count(*)::int FROM "tasks" WHERE ${ownerFilter} AND "status" = 'completed')`,
            })
            .from(sql`(SELECT 1) dummy`);

          if (statsRes) {
            stats = statsRes;
            taskStatsCache.set(statsKey, { data: statsRes, timestamp: nowTime });
          }
        } catch (err) {
          stats = {
            totalAll: list.length,
            pendingCount: list.filter((t) => ['pending', 'in_progress', 'waiting'].includes(t.status)).length,
            overdueCount: list.filter((t) => new Date(t.dueAt).getTime() < Date.now() && ['pending', 'in_progress', 'waiting'].includes(t.status)).length,
            completedCount: list.filter((t) => t.status === 'completed').length,
          };
        }
      }

      const formatted = list.map((t) => {
        // Parse metadata if available in description or standard fields
        let parsedTaskType = 'whatsapp';
        let visitLocation: string | null = null;

        if (t.description && t.description.includes('[TYPE:')) {
          const match = t.description.match(/\[TYPE:([a-z_]+)\]/);
          if (match && match[1]) parsedTaskType = match[1];
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
          timeZone: 'Asia/Jakarta',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const locationText = visitLocation || (t.person ? t.person.cityRegency || 'Kediaman / Lokasi yang disepakati' : 'Lokasi yang disepakati');

        const waVisitationMessage = ['interaction','jamaah_room_entry'].includes(t.relatedType||'') ? `Assalamu'alaikum ${jamaahName}. Kami dari Yayasan Tarbiyah Sunnah ingin menindaklanjuti ${t.title.replace(/^Follow-up: /,'')}. Petugas kami ${staffName} akan menghubungi sesuai waktu yang disepakati. Barakallahu fiikum.` : `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${jamaahName},\n\nKami dari Yayasan Tarbiyah Sunnah menugaskan ${staffName} untuk bersilaturahmi dan bertemu dengan Bapak/Ibu pada:\n📅 Waktu: ${dueFormatted} WIB\n📍 Tempat: ${locationText}\n📌 Agenda: ${t.title}\n\nTerima kasih banyak sudah berkenan menerima kami. Semoga Allah memberkahi waktu dan urusan kita semua. Barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`;

        const waPhoneClean = t.person?.phoneE164 ? t.person.phoneE164.replace(/[^0-9]/g, '') : null;
        const waDirectUrl = waPhoneClean
          ? `https://wa.me/${waPhoneClean}?text=${encodeURIComponent(waVisitationMessage)}`
          : null;

        return {
          id: t.id,
          relatedType: t.relatedType,
          relatedId: t.relatedId,
          title: t.title,
          description: cleanDescription,
          rawDescription: t.description,
          taskType: parsedTaskType,
          visitLocation,
          status: t.status,
          priority: t.priority,
          dueAt: t.dueAt,
          isOverdue: new Date(t.dueAt).getTime() < Date.now() && ['pending', 'in_progress', 'waiting'].includes(t.status),
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

      return successResponse(formatted, {
        requestId: ctx.requestId,
        total: formatted.length,
        pagination: {
          page,
          pageSize: pageSize || formatted.length,
          totalCount,
          totalPages: pageSize ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1,
        },
        stats,
      });
    })
  );

  // POST /api/tasks
  router.post(
    '/api/tasks',
    requireAuth(
      validateBody(createTaskSchema, async (ctx, body) => {
        const db = getDb();
        if (!ctx.user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        if (!hasPermission(ctx.user.roles, PERMISSIONS.TASKS_CREATE)) return errorResponse('FORBIDDEN', 'Izin membuat tugas diperlukan.', 403, ctx.requestId);
        const assignedOwnerId = body.ownerUserId || ctx.user.id;
        if (assignedOwnerId !== ctx.user.id && !hasPermission(ctx.user.roles, PERMISSIONS.TASKS_REASSIGN)) return errorResponse('FORBIDDEN', 'Penugasan ke staf lain hanya tersedia untuk administrator.', 403, ctx.requestId);

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

        taskStatsCache.clear();
        return successResponse(created, { requestId: ctx.requestId }, 201);
      })
    )
  );

  // PATCH /api/tasks/:id/status
  router.patch(
    '/api/tasks/:id/status',
    requireAuth(
      validateBody(updateTaskStatusSchema, async (ctx, body) => {
        const taskId = ctx.params.id;

        if (!taskId) return errorResponse('VALIDATION_ERROR', 'ID Task diperlukan', 400, ctx.requestId);
        const user = ctx.user!;
        if (!hasPermission(user.roles, PERMISSIONS.TASKS_UPDATE_OWN) && !hasPermission(user.roles, PERMISSIONS.TASKS_MANAGE_OWN)) return errorResponse('FORBIDDEN', 'Izin memperbarui tugas diperlukan.', 403, ctx.requestId);

        try{return successResponse(await changeTaskStatus(ctx,body.status),{requestId:ctx.requestId});}
        catch(error){if(error instanceof InteractionError)return errorResponse(error.status===404?'NOT_FOUND':error.status===409?'CONFLICT':'VALIDATION_ERROR',error.message,error.status,ctx.requestId);throw error;}
      })
    )
  );

  // POST /api/tasks/:id/reassign
  router.post(
    '/api/tasks/:id/reassign',
    requirePermission(PERMISSIONS.TASKS_REASSIGN,
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

        if(['interaction','jamaah_room_entry'].includes(current.relatedType||'')){
          try{return successResponse(await (current.relatedType==='interaction'?moveInteractionTask:moveRoomTask)(ctx,taskId,body.newOwnerUserId,body.reason),{requestId:ctx.requestId});}
          catch(error){if(error instanceof InteractionError||error instanceof RoomError)return errorResponse(error.status===403?'FORBIDDEN':error.status===404?'NOT_FOUND':error.status===409?'CONFLICT':'VALIDATION_ERROR',error.message,error.status,ctx.requestId);throw error;}
        }

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

        taskStatsCache.clear();
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
        if (!hasPermission(actor.roles, PERMISSIONS.TASKS_CREATE) || (!hasPermission(actor.roles, PERMISSIONS.TASKS_VIEW_ALL) && task.ownerUserId !== actor.id)) return errorResponse('FORBIDDEN', 'Hanya petugas yang ditugaskan dapat mengirim pemberitahuan.', 403, ctx.requestId);
        const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
        const result = await sendEmail({ to: body.recipientEmail, subject: `YTS · ${task.title}`, html: renderEmailLayout('Pemberitahuan kunjungan', `<p>Assalamu’alaikum ${escape(task.person?.fullName || 'Bapak/Ibu')},</p><p>${escape(task.title)}</p><p>${escape(body.notes || '')}</p>`), text: `${task.title}\n${body.notes || ''}` });
        if (!result.success) return errorResponse('INTERNAL_ERROR', result.error || 'Email belum berhasil dikirim.', 502, ctx.requestId);

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
      if (!hasPermission(ctx.user!.roles, PERMISSIONS.TASKS_CREATE) && !hasPermission(ctx.user!.roles, PERMISSIONS.TASKS_VIEW_OWN)) return errorResponse('FORBIDDEN', 'Izin tugas diperlukan.', 403, ctx.requestId);
      const db = getDb();
      const staffUsers = await db.query.appUsers.findMany({
        where: and(eq(appUsers.isActive, true), hasPermission(ctx.user!.roles, PERMISSIONS.TASKS_REASSIGN) ? undefined : eq(appUsers.id, ctx.user!.id)),
        columns: { id: true, fullName: true, email: true },
      });
      return successResponse(staffUsers, { requestId: ctx.requestId });
    })
  );

  // DELETE /api/tasks/:id
  router.delete(
    '/api/tasks/:id',
    requireAuth(async (ctx) => {
      const db = getDb();
      const taskId = ctx.params.id;
      const actor = ctx.user;
      if (!actor) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
      if (!taskId) return errorResponse('VALIDATION_ERROR', 'ID Task diperlukan', 400, ctx.requestId);

      const current = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
      });
      if (!current) return errorResponse('NOT_FOUND', 'Tugas tidak ditemukan', 404, ctx.requestId);

      if (!hasPermission(actor.roles, PERMISSIONS.TASKS_MANAGE_OWN) && !hasPermission(actor.roles, PERMISSIONS.TASKS_UPDATE_OWN)) return errorResponse('FORBIDDEN', 'Izin mengelola tugas diperlukan.', 403, ctx.requestId);
      if (!hasPermission(actor.roles, PERMISSIONS.TASKS_VIEW_ALL) && current.ownerUserId !== actor.id) return errorResponse('FORBIDDEN', 'Anda hanya dapat mengelola tugas sendiri.', 403, ctx.requestId);
      if(['interaction','jamaah_room_entry'].includes(current.relatedType||''))return errorResponse('CONFLICT','Gunakan status Dibatalkan agar riwayat tindak lanjut tetap terhubung.',409,ctx.requestId);
      await db.delete(tasks).where(and(eq(tasks.id, taskId), hasPermission(actor.roles, PERMISSIONS.TASKS_VIEW_ALL) ? undefined : eq(tasks.ownerUserId, actor.id)));
      taskStatsCache.clear();

      await logAuditEvent({
        actorUserId: actor.id,
        action: 'delete_task',
        entityType: 'task',
        entityId: taskId,
        beforeJson: { title: current.title, ownerUserId: current.ownerUserId },
        reason: `Penghapusan amanah tugas ${current.title} oleh ${actor.fullName}`,
        requestId: ctx.requestId,
      });

      return successResponse({ success: true }, { requestId: ctx.requestId });
    })
  );
}
