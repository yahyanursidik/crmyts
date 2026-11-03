import { getDb } from '../../server/db/client';
import { processPendingEventBroadcasts } from '../../server/domain/events/broadcastQueue';

/**
 * This scheduler never starts a campaign itself. It only continues queues that
 * an authenticated admin has deliberately created from a kajian dashboard.
 *
 * Dijalankan empat kali sehari, bukan tiap jam, karena setiap invocation
 * membangunkan compute Neon selama 5 menit walau antrean kosong. Satu run
 * memproses MAX_BATCH_SIZE (100) penerima, jadi 4 run menutup
 * MAILKETING_BROADCAST_DAILY_LIMIT yang dibatasi 400 per hari WIB.
 *
 * Untuk mengosongkan antrean segera: tombol Run now pada halaman Functions di
 * dashboard Netlify, atau `netlify functions:invoke`.
 */
export const config = { schedule: '20 */6 * * *' };

export default async () => {
  try {
    await processPendingEventBroadcasts(getDb());
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error('[Event Email Broadcast Queue Error]:', error);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
