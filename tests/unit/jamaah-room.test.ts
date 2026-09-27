import { afterEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../../server/http/router';
import { containsContactDetail, parseRoomDate, registerJamaahRoomRoutes, roomSubmissionSchema } from '../../server/domain/jamaah-room/routes';
import * as client from '../../server/db/client';
import { ROLES } from '../../server/permissions/constants';

const router = new Router();
registerJamaahRoomRoutes(router);

describe('Ruang Jamaah', () => {
  afterEach(() => vi.restoreAllMocks());
  const base = { category: 'saran', subject: 'Masukan kajian', message: 'Saya ingin menyampaikan masukan tentang pelayanan kajian.', wantsReply: false };

  it('requires a contact method only when the jamaah asks for a reply', () => {
    expect(roomSubmissionSchema.safeParse(base).success).toBe(true);
    expect(roomSubmissionSchema.safeParse({ ...base, wantsReply: true }).success).toBe(false);
    expect(roomSubmissionSchema.safeParse({ ...base, wantsReply: true, email: 'jamaah@example.com' }).success).toBe(true);
  });

  it('only allows publication consent for stories or experiences', () => {
    expect(roomSubmissionSchema.safeParse({ ...base, publicationConsent: true }).success).toBe(false);
    expect(roomSubmissionSchema.safeParse({ ...base, category: 'cerita', publicationConsent: true }).success).toBe(true);
    expect(roomSubmissionSchema.safeParse({ ...base, category: 'pengalaman', publicationConsent: true }).success).toBe(true);
  });

  it('rejects excessive content and invalid contact data', () => {
    expect(roomSubmissionSchema.safeParse({ ...base, message: 'x'.repeat(4001) }).success).toBe(false);
    expect(roomSubmissionSchema.safeParse({ ...base, phone: 'not-a-phone' }).success).toBe(false);
  });

  it('detects contact details before a curated story is made public', () => {
    expect(containsContactDetail('Hubungi saya di 081234567890')).toBe(true);
    expect(containsContactDetail('Alamat saya nama@example.com')).toBe(true);
    expect(containsContactDetail('Kajian 19 September 2026 pukul 08.00')).toBe(false);
    expect(containsContactDetail('Kajian 2026-09-27 pukul 08.00')).toBe(false);
  });

  it('parses inbox dates as full Jakarta calendar days', () => {
    expect(parseRoomDate('2026-09-27')?.toISOString()).toBe('2026-09-26T17:00:00.000Z');
    expect(parseRoomDate('2026-02-30')).toBeNull();
    expect(parseRoomDate('27-09-2026')).toBeNull();
  });

  it('blocks public access to the private inbox and moderation', async () => {
    const context = { requestId: 'test', method: 'GET', path: '/api/jamaah-room', headers: {}, query: {}, body: null, params: {} };
    const list = await router.handle(context);
    const edit = await router.handle({ ...context, method: 'PATCH', path: '/api/jamaah-room/018f0000-0000-7000-8000-000000000001', body: { published: true } });
    const detail = await router.handle({ ...context, path: '/api/jamaah-room/018f0000-0000-7000-8000-000000000001' });
    const bulk = await router.handle({ ...context, method: 'PATCH', path: '/api/jamaah-room/bulk-review', body: { ids: ['018f0000-0000-7000-8000-000000000001'] } });
    expect(list.statusCode).toBe(401);
    expect(edit.statusCode).toBe(401);
    expect(detail.statusCode).toBe(401);
    expect(bulk.statusCode).toBe(401);
  });

  it('rejects duplicate or excessive bulk selections before database access', async () => {
    const id = '018f0000-0000-7000-8000-000000000001';
    const context = { requestId: 'test', method: 'PATCH', path: '/api/jamaah-room/bulk-review',
      headers: {}, query: {}, params: {}, user: { id, authSubject: 'admin', email: 'admin@example.com', fullName: 'Admin',
        roles: [ROLES.CRM_ADMIN], permissions: [], isActive: true } };
    expect((await router.handle({ ...context, body: { ids: [id, id] } })).statusCode).toBe(400);
    expect((await router.handle({ ...context, body: { ids: Array.from({ length: 26 }, (_, index) =>
      `018f0000-0000-7000-8000-${String(index).padStart(12, '0')}`) } })).statusCode).toBe(400);
  });

  it('rejects invalid inbox filters before database access', async () => {
    const id = '018f0000-0000-7000-8000-000000000001';
    const context = { requestId: 'test', method: 'GET', path: '/api/jamaah-room',
      headers: {}, params: {}, body: null, user: { id, authSubject: 'admin', email: 'admin@example.com', fullName: 'Admin',
        roles: [ROLES.CRM_ADMIN], permissions: [], isActive: true } };
    expect((await router.handle({ ...context, query: { queue: 'unknown' } })).statusCode).toBe(400);
    expect((await router.handle({ ...context, query: { from: '2026-02-30' } })).statusCode).toBe(400);
    expect((await router.handle({ ...context, query: { from: '2026-09-27', to: '2026-09-26' } })).statusCode).toBe(400);
  });

  it('rejects invalid submissions before touching the database', async () => {
    const response = await router.handle({ requestId: 'test', method: 'POST', path: '/api/public/jamaah-room',
      headers: {}, query: {}, params: {}, body: { ...base, message: 'short' } });
    expect(response.statusCode).toBe(400);
  });

  it('refuses publication when the jamaah did not consent', async () => {
    const id = '018f0000-0000-7000-8000-000000000001';
    const before = { id, category: 'cerita', publicationConsent: false, publicTitle: null,
      publicText: null, status: 'new', response: null, publishedAt: null };
    const update = vi.fn();
    const db = { execute: vi.fn().mockResolvedValue({ rows: [] }), update,
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([before]) }) }) })) };
    vi.spyOn(client, 'getDb').mockReturnValue(db as any);
    const result = await router.handle({ requestId: 'test', method: 'PATCH', path: `/api/jamaah-room/${id}`,
      headers: {}, query: {}, params: {}, body: { published: true, publicTitle: 'Cerita kajian',
        publicText: 'Awalnya saya datang sendiri, lalu merasa diterima dengan baik.' },
      user: { id, authSubject: 'admin', email: 'admin@example.com', fullName: 'Admin',
        roles: [ROLES.CRM_ADMIN], permissions: [], isActive: true } });
    expect(result.statusCode).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns only curated story fields to public readers', async () => {
    const db = { execute: vi.fn().mockResolvedValue({ rows: [] }),
      select: vi.fn(() => ({ from: () => ({ leftJoin: () => ({ where: () => ({ orderBy: () => ({
        limit: () => Promise.resolve([{ id: 'story-1', subject: 'Datang sendiri',
          message: 'Saya datang sendiri dan pulang dengan teman baru.', name: 'nama@example.com',
          anonymousPublication: false, eventTitle: 'Kajian', publishedAt: new Date() }]),
      }) }) }) }) })) };
    vi.spyOn(client, 'getDb').mockReturnValue(db as any);
    const result = await router.handle({ requestId: 'test', method: 'GET', path: '/api/public/jamaah-room/stories',
      headers: {}, query: {}, params: {}, body: null });
    const story = JSON.parse(result.body).data[0];
    expect(result.statusCode).toBe(200);
    expect(story.displayName).toBe('Jamaah YTS');
    expect(story).not.toHaveProperty('name');
    expect(story).not.toHaveProperty('email');
    expect(story).not.toHaveProperty('phone');
  });
});
