import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse } from '../../server/http/response';
import { Router } from '../../server/http/router';
import { RequestContext } from '../../server/http/middleware';

describe('HTTP Response & Router Foundation', () => {
  it('should format success response conforming to API contract', () => {
    const res = successResponse({ id: '123', name: 'Ahmad' }, { requestId: 'req_1', total: 1 });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual({ id: '123', name: 'Ahmad' });
    expect(body.meta.requestId).toBe('req_1');
    expect(body.meta.total).toBe(1);
  });

  it('should format error response conforming to API contract', () => {
    const res = errorResponse('FORBIDDEN', 'Akses ditolak', 403, 'req_err_99');
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toBe('Akses ditolak');
    expect(body.error.requestId).toBe('req_err_99');
  });

  it('router should route GET /api/test and extract URL params', async () => {
    const router = new Router();
    router.get('/api/persons/:id', async (ctx) => {
      return successResponse({ id: ctx.params.id });
    });

    const ctx: RequestContext = {
      requestId: 'test_req',
      method: 'GET',
      path: '/api/persons/usr_uuid_88',
      headers: {},
      query: {},
      body: null,
      params: {},
    };

    const res = await router.handle(ctx);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe('usr_uuid_88');
  });

  it('router should return 404 for non-existent route', async () => {
    const router = new Router();
    const ctx: RequestContext = {
      requestId: 'test_req_404',
      method: 'GET',
      path: '/api/unknown-endpoint',
      headers: {},
      query: {},
      body: null,
      params: {},
    };

    const res = await router.handle(ctx);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
