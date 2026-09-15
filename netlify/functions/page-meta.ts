import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../../server/db/client';
import { events } from '../../server/db/schema';

interface NetlifyEvent {
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined> | null;
}

let cachedShell: string | null = null;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character] || character));
}

function cleanDescription(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

async function getAppShell() {
  if (cachedShell) return cachedShell;

  const candidates = [
    join(process.cwd(), 'dist', 'index.html'),
    join(process.cwd(), 'index.html'),
  ];

  for (const path of candidates) {
    try {
      cachedShell = await readFile(path, 'utf8');
      return cachedShell;
    } catch {
      // Try the next known location. The production build includes dist/index.html.
    }
  }

  throw new Error('Application shell tidak ditemukan.');
}

function replaceManagedTag(html: string, key: string, tag: string) {
  return html.replace(new RegExp(`<[^>]+data-page-meta="${key}"[^>]*>`, 'i'), tag);
}

function injectMetadata(html: string, title: string, description: string, canonicalUrl: string) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedUrl = escapeHtml(canonicalUrl);
  const imageUrl = `${new URL(canonicalUrl).origin}/logo.png`;

  let page = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapedTitle}</title>`);
  page = replaceManagedTag(page, 'description', `<meta data-page-meta="description" name="description" content="${escapedDescription}" />`);
  page = replaceManagedTag(page, 'canonical', `<link data-page-meta="canonical" rel="canonical" href="${escapedUrl}" />`);
  page = replaceManagedTag(page, 'og-title', `<meta data-page-meta="og-title" property="og:title" content="${escapedTitle}" />`);
  page = replaceManagedTag(page, 'og-description', `<meta data-page-meta="og-description" property="og:description" content="${escapedDescription}" />`);
  page = replaceManagedTag(page, 'og-url', `<meta data-page-meta="og-url" property="og:url" content="${escapedUrl}" />`);
  page = replaceManagedTag(page, 'og-image', `<meta data-page-meta="og-image" property="og:image" content="${escapeHtml(imageUrl)}" />`);
  page = replaceManagedTag(page, 'twitter-title', `<meta data-page-meta="twitter-title" name="twitter:title" content="${escapedTitle}" />`);
  return replaceManagedTag(page, 'twitter-description', `<meta data-page-meta="twitter-description" name="twitter:description" content="${escapedDescription}" />`);
}

export const handler = async (event: NetlifyEvent) => {
  const eventId = event.queryStringParameters?.eventId;
  const host = event.headers.host || 'app.yts.web.id';
  const protocol = event.headers['x-forwarded-proto'] || 'https';
  const canonicalUrl = `${protocol}://${host}/kajian/${encodeURIComponent(eventId || '')}`;
  const defaultTitle = 'Pendaftaran Kajian | Yayasan Tarbiyah Sunnah';
  const defaultDescription = 'Informasi dan pendaftaran resmi kajian Yayasan Tarbiyah Sunnah.';

  try {
    const shell = await getAppShell();
    if (!eventId) {
      return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: injectMetadata(shell, defaultTitle, defaultDescription, `${protocol}://${host}/kajian`) };
    }

    const eventItem = await getDb().query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { title: true, speaker: true, locationName: true, description: true },
    });
    const title = eventItem ? `${eventItem.title} | Pendaftaran Kajian YTS` : defaultTitle;
    const description = eventItem
      ? cleanDescription(eventItem.description) || `Pendaftaran ${eventItem.title}${eventItem.speaker ? ` bersama ${eventItem.speaker}` : ''}${eventItem.locationName ? ` di ${eventItem.locationName}` : ''}.`
      : defaultDescription;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      body: injectMetadata(shell, title, description, canonicalUrl),
    };
  } catch (error) {
    console.error('[Page Metadata Error]:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Halaman tidak dapat dimuat.' };
  }
};
