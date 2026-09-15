import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { eventAttendance } from '../../db/schema';
import { getBroadcastDailyQuota, reserveBroadcastEmailSlot } from '../../email/broadcastQuota';
import { sendEventAnnouncementEmail } from '../../email/service';
import { formatEventDateTimeWib, sendEventReminder, type EventEmailEvent } from './emailNotifications';

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
 * Delivers one manually-triggered reminder per email address and reserves the
 * shared broadcast quota before each provider request.
 */
export async function dispatchEventReminders(
  db: any,
  event: EventEmailEvent
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

export async function dispatchEventBroadcast(
  db: any,
  event: EventEmailEvent,
  input: { subject: string; message: string }
): Promise<EventReminderDispatchResult> {
  const attendances: ReminderAttendance[] = await db.query.eventAttendance.findMany({
    where: eq(eventAttendance.eventId, event.id),
    with: { person: true },
  });
  const recipients = new Map<string, ReminderAttendance>();
  const contentKey = createHash('sha256').update(`${event.id}\n${input.subject}\n${input.message}`).digest('hex');
  const retryAfter = Date.now() - 24 * 60 * 60 * 1000;
  let skippedNoEmail = 0;
  let skippedAlreadySent = 0;

  for (const attendance of attendances) {
    const email = attendance.person?.email?.trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (recipients.has(email)) continue;
    const history = attendance.registrationData?.emailNotifications?.broadcastHistory;
    const sentRecently = Array.isArray(history) && history.some(
      (item: any) => item?.key === contentKey && new Date(item.sentAt || 0).getTime() >= retryAfter
    );
    if (sentRecently) {
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
    const delivery = await sendEventAnnouncementEmail({
      recipientEmail: attendance.person?.email || '',
      recipientName: attendance.person?.fullName || 'Jamaah YTS',
      subject: input.subject,
      message: input.message,
      eventTitle: event.title,
      speaker: event.speaker,
      startAtFormatted: formatEventDateTimeWib(event.startAt),
      locationName: event.locationName || 'Masjid Tarbiyah Sunnah',
      ticketCode: attendance.ticketCode || '-',
    });
    if (!delivery.success) {
      failed++;
      continue;
    }
    sent++;
    const previous = attendance.registrationData || {};
    const notifications = previous.emailNotifications || {};
    const history = Array.isArray(notifications.broadcastHistory) ? notifications.broadcastHistory : [];
    await db.update(eventAttendance).set({
      registrationData: {
        ...previous,
        emailNotifications: {
          ...notifications,
          broadcastHistory: [...history, { key: contentKey, sentAt: new Date().toISOString(), messageId: delivery.messageId || null }].slice(-10),
        },
      },
    }).where(eq(eventAttendance.id, attendance.id));
  }

  return { attempted: recipients.size, sent, skippedNoEmail, skippedAlreadySent, failed, quotaReached, remainingToday: quota.remainingToday };
}
