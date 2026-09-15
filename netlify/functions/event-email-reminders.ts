import { and, gte, lte } from 'drizzle-orm';
import { getDb } from '../../server/db/client';
import { events } from '../../server/db/schema';
import { getEventEmailSettings } from '../../server/domain/events/emailNotifications';
import { dispatchEventReminders } from '../../server/domain/events/reminderDispatch';

// Runs every hour. Per-attendance delivery markers make retries safe.
export const config = { schedule: '0 * * * *' };

export const handler = async () => {
  const now = new Date();
  const latestReminderWindow = new Date(now.getTime() + 168 * 60 * 60 * 1000);
  const db = getDb();

  try {
    const upcoming = await db.query.events.findMany({
      where: and(gte(events.startAt, now), lte(events.startAt, latestReminderWindow)),
      orderBy: [events.startAt],
    });

    const processed: Array<{ eventId: string; sent: number; failed: number }> = [];
    for (const event of upcoming) {
      const settings = getEventEmailSettings(event.formConfig);
      if (!settings.reminderEnabled) continue;

      const minutesUntilStart = (new Date(event.startAt).getTime() - now.getTime()) / 60_000;
      const targetMinutes = settings.reminderHoursBefore * 60;
      // A 90-minute window protects against a delayed scheduled invocation.
      if (minutesUntilStart > targetMinutes || minutesUntilStart < targetMinutes - 90) continue;

      const result = await dispatchEventReminders(db, event, 'automatic');
      processed.push({ eventId: event.id, sent: result.sent, failed: result.failed });
      if (result.quotaReached) break;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, processed }) };
  } catch (error: any) {
    console.error('[Event Email Reminder Scheduler Error]:', error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error?.message || 'Gagal menjalankan reminder kajian.' }) };
  }
};
