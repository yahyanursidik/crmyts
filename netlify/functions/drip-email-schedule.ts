import { processDueDripCampaigns } from '../../server/domain/automation/routes';

/**
 * Dijalankan empat kali sehari, bukan tiap jam. Setiap invocation selalu query
 * database walau tidak ada kampanye berjalan, dan satu query membangunkan
 * compute Neon selama 5 menit penuh karena suspend timeout minimum pada plan
 * ini 300 detik. isDripCampaignDue hanya membandingkan jam WIB, jadi kampanye
 * tetap terkirim pada harinya.
 *
 * Untuk menjalankan segera di luar jadwal: tombol Run now pada halaman
 * Functions di dashboard Netlify, atau `netlify functions:invoke`.
 */
export const config = { schedule: '20 */6 * * *' };

export default async () => {
  try {
    const result = await processDueDripCampaigns();
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (error) {
    console.error('[Drip Email Schedule Error]', error);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
