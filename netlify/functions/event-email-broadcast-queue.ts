import { getDb } from '../../server/db/client';
import { processPendingEventBroadcasts } from '../../server/domain/events/broadcastQueue';

/**
 * This scheduler never starts a campaign itself. It only continues queues that
 * an authenticated admin has deliberately created from a kajian dashboard.
 */
export const config = { schedule: '*/15 * * * *' };

export default async () => {
  try {
    await processPendingEventBroadcasts(getDb());
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error('[Event Email Broadcast Queue Error]:', error);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
