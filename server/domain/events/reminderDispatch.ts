import { createHash, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
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

export type EventBroadcastSummary = {
  id: string;
  subject: string;
  createdAt: string;
  intendedRecipients: number;
  attemptedCount: number;
  unattemptedCount: number;
  providerAcceptedCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  failedCount: number;
  noNegativeSignalCount: number;
};

type BroadcastHistoryEntry = {
  broadcastId?: string;
  key?: string;
  subject?: string;
  createdAt?: string;
  targetRecipients?: number;
  sentAt?: string;
  messageId?: string | null;
  status?: 'accepted' | 'failed' | 'bounced' | 'unsubscribed' | 'opened' | 'clicked';
  failedAt?: string;
  failureReason?: string | null;
  openedAt?: string;
  clickedAt?: string;
  bouncedAt?: string;
  unsubscribedAt?: string;
};

type EventBroadcastDispatchResult = EventReminderDispatchResult & { broadcastId: string };

function broadcastHistoryFor(attendance: ReminderAttendance): BroadcastHistoryEntry[] {
  const history = attendance.registrationData?.emailNotifications?.broadcastHistory;
  return Array.isArray(history) ? history : [];
}

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
): Promise<EventBroadcastDispatchResult> {
  const attendances: ReminderAttendance[] = await db.query.eventAttendance.findMany({
    where: eq(eventAttendance.eventId, event.id),
    with: { person: true },
  });
  const recipients = new Map<string, ReminderAttendance>();
  const contentKey = createHash('sha256').update(`${event.id}\n${input.subject}\n${input.message}`).digest('hex');
  const broadcastId = randomUUID();
  const createdAt = new Date().toISOString();
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
    const history = broadcastHistoryFor(attendance);
    const sentRecently = history.some(
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
    const previous = attendance.registrationData || {};
    const notifications = previous.emailNotifications || {};
    const history: BroadcastHistoryEntry[] = Array.isArray(notifications.broadcastHistory) ? notifications.broadcastHistory : [];
    const baseHistory = {
      broadcastId,
      key: contentKey,
      subject: input.subject,
      createdAt,
      targetRecipients: recipients.size,
    };

    if (!delivery.success) {
      failed++;
      await db.update(eventAttendance).set({
        registrationData: {
          ...previous,
          emailNotifications: {
            ...notifications,
            broadcastHistory: [...history, {
              ...baseHistory,
              status: 'failed',
              failedAt: new Date().toISOString(),
              failureReason: delivery.error ? String(delivery.error).slice(0, 300) : null,
              messageId: delivery.messageId || null,
            }].slice(-20),
          },
        },
      }).where(eq(eventAttendance.id, attendance.id));
      continue;
    }

    sent++;
    await db.update(eventAttendance).set({
      registrationData: {
        ...previous,
        emailNotifications: {
          ...notifications,
          broadcastHistory: [...history, {
            ...baseHistory,
            status: 'accepted',
            sentAt: new Date().toISOString(),
            messageId: delivery.messageId || null,
          }].slice(-20),
        },
      },
    }).where(eq(eventAttendance.id, attendance.id));
  }

  return { broadcastId, attempted: recipients.size, sent, skippedNoEmail, skippedAlreadySent, failed, quotaReached, remainingToday: quota.remainingToday };
}

/** Returns recent manual broadcasts with only provider-confirmed delivery signals. */
export async function listEventBroadcastSummaries(db: any, eventId: string): Promise<EventBroadcastSummary[]> {
  const attendances: ReminderAttendance[] = await db.query.eventAttendance.findMany({
    where: eq(eventAttendance.eventId, eventId),
  });
  const campaigns = new Map<string, EventBroadcastSummary>();

  for (const attendance of attendances) {
    for (const item of broadcastHistoryFor(attendance)) {
      if (!item.broadcastId || !item.createdAt) continue;
      const existing = campaigns.get(item.broadcastId) || {
        id: item.broadcastId,
        subject: item.subject || 'Broadcast peserta kajian',
        createdAt: item.createdAt,
        intendedRecipients: 0,
        attemptedCount: 0,
        unattemptedCount: 0,
        providerAcceptedCount: 0,
        openedCount: 0,
        clickedCount: 0,
        bouncedCount: 0,
        unsubscribedCount: 0,
        failedCount: 0,
        noNegativeSignalCount: 0,
      };

      existing.intendedRecipients = Math.max(existing.intendedRecipients, Number(item.targetRecipients) || 0);
      existing.attemptedCount++;
      const accepted = Boolean(item.messageId) && item.status !== 'failed';
      if (accepted) existing.providerAcceptedCount++;
      if (item.openedAt || item.status === 'opened' || item.status === 'clicked') existing.openedCount++;
      if (item.clickedAt || item.status === 'clicked') existing.clickedCount++;
      if (item.bouncedAt || item.status === 'bounced') existing.bouncedCount++;
      if (item.unsubscribedAt || item.status === 'unsubscribed') existing.unsubscribedCount++;
      if (item.failedAt || item.status === 'failed' || item.bouncedAt || item.status === 'bounced') existing.failedCount++;
      campaigns.set(item.broadcastId, existing);
    }
  }

  return [...campaigns.values()]
    .map((campaign) => ({
      ...campaign,
      unattemptedCount: Math.max(0, campaign.intendedRecipients - campaign.attemptedCount),
      noNegativeSignalCount: Math.max(0, campaign.providerAcceptedCount - campaign.bouncedCount - campaign.unsubscribedCount),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);
}

/** Updates a tracked event broadcast when Mailketing sends a recipient event. */
export async function recordEventBroadcastWebhook(
  db: any,
  payload: { type: 'emailopen' | 'emailclick' | 'bounce' | 'unsubscribe'; messageId: string; occurredAt?: string }
): Promise<void> {
  const matchingHistory = JSON.stringify({ emailNotifications: { broadcastHistory: [{ messageId: payload.messageId }] } });
  const attendances: ReminderAttendance[] = await db.query.eventAttendance.findMany({
    where: sql`${eventAttendance.registrationData} @> ${matchingHistory}::jsonb`,
  });
  const occurredAt = payload.occurredAt || new Date().toISOString();

  for (const attendance of attendances) {
    const previous = attendance.registrationData || {};
    const notifications = previous.emailNotifications || {};
    const history = broadcastHistoryFor(attendance);
    const nextHistory = history.map((item) => {
      if (item.messageId !== payload.messageId) return item;
      if (payload.type === 'emailopen') return { ...item, status: 'opened' as const, openedAt: item.openedAt || occurredAt };
      if (payload.type === 'emailclick') return { ...item, status: 'clicked' as const, openedAt: item.openedAt || occurredAt, clickedAt: item.clickedAt || occurredAt };
      if (payload.type === 'bounce') return { ...item, status: 'bounced' as const, bouncedAt: item.bouncedAt || occurredAt };
      return { ...item, status: 'unsubscribed' as const, unsubscribedAt: item.unsubscribedAt || occurredAt };
    });
    await db.update(eventAttendance).set({
      registrationData: { ...previous, emailNotifications: { ...notifications, broadcastHistory: nextHistory } },
    }).where(eq(eventAttendance.id, attendance.id));
  }
}
