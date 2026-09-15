import { eq } from 'drizzle-orm';
import { eventAttendance } from '../../db/schema';
import { getBroadcastDailyQuota, reserveBroadcastEmailSlot } from '../../email/broadcastQuota';
import { sendEventReminder, type EventEmailEvent } from './emailNotifications';

type ReminderAttendance = {
  id: string;
  ticketCode?: string | null;
  registrationData?: Record<string, any> | null;
  person?: {
    email?: string | null;
    fullName?: string | null;
    gender?: 'ikhwan' | 'akhwat' | null;
  } | null;
};

export type EventReminderDispatchResult = {
  attempted: number;
  sent: number;
  skippedNoEmail: number;
  skippedAlreadySent: number;
  failed: number;
  quotaReached: boolean;
  remainingToday: number;
};

/**
 * Delivers one reminder per email address and reserves the shared broadcast quota
 * before each provider request. Automatic runs record delivery per attendance.
 */
export async function dispatchEventReminders(
  db: any,
  event: EventEmailEvent,
  mode: 'manual' | 'automatic'
): Promise<EventReminderDispatchResult> {
  const attendances: ReminderAttendance[] = await db.query.eventAttendance.findMany({
    where: eq(eventAttendance.eventId, event.id),
    with: { person: true },
  });

  const recipients = new Map<string, ReminderAttendance>();
  let skippedNoEmail = 0;
  let skippedAlreadySent = 0;

  for (const attendance of attendances) {
    const email = attendance.person?.email?.trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (recipients.has(email)) continue;

    const reminderSentAt = attendance.registrationData?.emailNotifications?.reminderH1SentAt;
    if (mode === 'automatic' && reminderSentAt) {
      skippedAlreadySent++;
      continue;
    }
    recipients.set(email, attendance);
  }

  let sent = 0;
  let failed = 0;
  let quotaReached = false;
  let quota = await getBroadcastDailyQuota(db);

  for (const attendance of recipients.values()) {
    const reserved = await reserveBroadcastEmailSlot(db);
    if (!reserved) {
      quotaReached = true;
      break;
    }
    quota = reserved;

    const delivery = await sendEventReminder({ event, attendance });
    if (!delivery.success) {
      failed++;
      continue;
    }

    sent++;
    const previous = attendance.registrationData || {};
    const notifications = previous.emailNotifications || {};
    await db
      .update(eventAttendance)
      .set({
        registrationData: {
          ...previous,
          emailNotifications: {
            ...notifications,
            reminderH1SentAt: new Date().toISOString(),
            reminderH1MessageId: delivery.messageId || null,
          },
        },
      })
      .where(eq(eventAttendance.id, attendance.id));
  }

  return {
    attempted: recipients.size,
    sent,
    skippedNoEmail,
    skippedAlreadySent,
    failed,
    quotaReached,
    remainingToday: quota.remainingToday,
  };
}
