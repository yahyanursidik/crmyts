import { and, eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { eventAttendance } from '../../db/schema';
import type { RegistrationDatabase } from './registrationLock';
import { createMemorableTicketCode } from './participantCodes';

/** Call under the event registration row lock, including each family member. */
export async function createAvailableTicketCode(
  db: RegistrationDatabase,
  eventId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const code =
      attempt < 20
        ? createMemorableTicketCode()
        : `YTS-${randomInt(100000, 1000000)}`;
    const existing = await db.query.eventAttendance.findFirst({
      where: and(
        eq(eventAttendance.eventId, eventId),
        eq(eventAttendance.ticketCode, code),
      ),
    });
    if (!existing) return code;
  }
  throw new Error('Kode tiket belum tersedia. Silakan coba kembali.');
}
