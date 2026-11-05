import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  appUsers,
  auditLogs,
  persons,
  tags,
  sensitiveNotes,
} from '../../db/schema';
import { requirePermission } from '../../http/middleware';
import { errorResponse, successResponse } from '../../http/response';
import { Router } from '../../http/router';
import { PERMISSIONS } from '../../permissions/constants';
import { z } from 'zod';

export class PersonConflict extends Error {
  constructor(readonly missingIds: string[]) {
    super('Data jamaah tidak ditemukan.');
  }
}
export class PersonMergeConflict extends Error {
  constructor() {
    super(
      'Jamaah ini sudah digabungkan ke profil utama dan tidak dapat dipulihkan sebagai duplikat. Buka Kualitas data untuk pemeriksaan.',
    );
  }
}

/** Archive/restore in one transaction; every attendance, donation and case remains intact. */
export async function setPersonArchive(
  ids: string[],
  active: boolean,
  actorId: string,
  requestId: string,
) {
  return getDb().transaction(async (tx) => {
    const people = await tx.query.persons.findMany({
      where: inArray(persons.id, ids),
      columns: { id: true, fullName: true, isActive: true },
    });
    if (people.length !== ids.length)
      throw new PersonConflict(
        ids.filter((id) => !people.some((person) => person.id === id)),
      );
    if (
      active &&
      people.some((person) => /\[MERGED -> .+\]$/.test(person.fullName))
    )
      throw new PersonMergeConflict();
    await tx
      .update(persons)
      .set({ isActive: active, updatedAt: new Date() })
      .where(inArray(persons.id, ids));
    await tx.insert(auditLogs).values(
      people.map((person) => ({
        actorUserId: actorId,
        action: active ? 'restore_person' : 'archive_person',
        entityType: 'persons',
        entityId: person.id,
        beforeJson: person,
        afterJson: { isActive: active },
        reason: active
          ? 'Pemulihan arsip jamaah'
          : 'Pengarsipan jamaah; riwayat dipertahankan',
        requestId,
      })),
    );
    return people;
  });
}

export function registerPersonOperations(
  router: Router,
  invalidate: () => void,
) {
  router.get(
    '/api/persons/options',
    requirePermission(PERMISSIONS.PERSONS_LIST, async (ctx) => {
      const db = getDb();
      const [staff, activeTags] = await Promise.all([
        db
          .select({ id: appUsers.id, fullName: appUsers.fullName })
          .from(appUsers)
          .where(eq(appUsers.isActive, true))
          .orderBy(asc(appUsers.fullName))
          .limit(1000),
        db
          .select({ id: tags.id, name: tags.name, category: tags.category })
          .from(tags)
          .where(eq(tags.isActive, true))
          .orderBy(asc(tags.name))
          .limit(500),
      ]);
      return successResponse(
        { staff, tags: activeTags },
        { requestId: ctx.requestId },
      );
    }),
  );
  router.get(
    '/api/persons/:id/summary',
    requirePermission(PERMISSIONS.PERSONS_LIST, async (ctx) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success)
        return errorResponse(
          'VALIDATION_ERROR',
          'ID jamaah tidak valid.',
          400,
          ctx.requestId,
        );
      const person = await getDb().query.persons.findFirst({
        where: eq(persons.id, ctx.params.id!),
        columns: {
          id: true,
          fullName: true,
          phoneE164: true,
          cityRegency: true,
          isActive: true,
        },
      });
      return person
        ? successResponse(person, { requestId: ctx.requestId })
        : errorResponse(
            'NOT_FOUND',
            'Jamaah tidak ditemukan.',
            404,
            ctx.requestId,
          );
    }),
  );
  router.post(
    '/api/persons/:id/restore',
    requirePermission(PERMISSIONS.PERSONS_DELETE, async (ctx) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success)
        return errorResponse(
          'VALIDATION_ERROR',
          'ID jamaah tidak valid.',
          400,
          ctx.requestId,
        );
      try {
        await setPersonArchive(
          [ctx.params.id!],
          true,
          ctx.user!.id,
          ctx.requestId,
        );
        invalidate();
        return successResponse(
          { success: true, isActive: true },
          { requestId: ctx.requestId },
        );
      } catch (error) {
        if (error instanceof PersonMergeConflict)
          return errorResponse('CONFLICT', error.message, 409, ctx.requestId);
        if (error instanceof PersonConflict)
          return errorResponse('NOT_FOUND', error.message, 404, ctx.requestId);
        throw error;
      }
    }),
  );
  router.post(
    '/api/persons/:id/sensitive-notes/:noteId/archive',
    requirePermission(PERMISSIONS.SENSITIVE_NOTES_DELETE, async (ctx) => {
      if (
        ![ctx.params.id, ctx.params.noteId].every(
          (id) => z.string().uuid().safeParse(id).success,
        )
      )
        return errorResponse(
          'VALIDATION_ERROR',
          'ID catatan tidak valid.',
          400,
          ctx.requestId,
        );
      const db = getDb();
      const archived = await db.transaction(async (tx) => {
        const [note] = await tx
          .update(sensitiveNotes)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(sensitiveNotes.id, ctx.params.noteId!),
              eq(sensitiveNotes.personId, ctx.params.id!),
              sql`${sensitiveNotes.deletedAt} IS NULL`,
            ),
          )
          .returning({ id: sensitiveNotes.id });
        if (note)
          await tx.insert(auditLogs).values({
            actorUserId: ctx.user!.id,
            action: 'archive_sensitive_note',
            entityType: 'sensitive_notes',
            entityId: note.id,
            reason: 'Pengarsipan catatan khusus jamaah',
            requestId: ctx.requestId,
          });
        return note;
      });
      return archived
        ? successResponse({ success: true }, { requestId: ctx.requestId })
        : errorResponse(
            'NOT_FOUND',
            'Catatan tidak ditemukan.',
            404,
            ctx.requestId,
          );
    }),
  );
}
