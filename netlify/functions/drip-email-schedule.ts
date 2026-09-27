import { processDueDripCampaigns } from '../../server/domain/automation/routes';

export const config = { schedule: '*/15 * * * *' };

export default async () => {
  try {
    const result = await processDueDripCampaigns();
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (error) {
    console.error('[Drip Email Schedule Error]', error);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
