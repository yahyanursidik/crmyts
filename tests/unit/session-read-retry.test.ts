import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryConnectionRead } from '../../server/db/readRetry';
import * as client from '../../server/db/client';
import { resolveUserBySubject } from '../../server/auth/service';
import * as authService from '../../server/auth/service';
import { createSessionToken } from '../../server/auth/token';

afterEach(() => vi.restoreAllMocks());
describe('Session connection recovery', () => {
  it('reports an unavailable session store as 503 so the client does not clear a valid token', async () => {
    vi.spyOn(authService, 'resolveUserBySubject').mockRejectedValue(new Error('Connection terminated unexpectedly'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { handler } = await import('../../netlify/functions/api');
    const token = createSessionToken({ userId: 'user-1', authSubject: 'staff', email: 'staff@example.test', sessionVersion: 1 });
    const response = await handler({ path: '/api/dashboard/stats', httpMethod: 'GET', headers: { authorization: `Bearer ${token}` }, queryStringParameters: {}, body: null });
    expect(response.statusCode).toBe(503);
    expect(response.headers['Retry-After']).toBe('1');
    expect(JSON.parse(response.body).error.code).toBe('INTERNAL_ERROR');
  });
  it('recovers one dropped read without retrying indefinitely', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('Connection terminated unexpectedly')).mockResolvedValue('fresh session');
    expect(await retryConnectionRead(read)).toBe('fresh session');
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('propagates a second connection failure', async () => {
    const failure = Object.assign(new Error('Network reset'), { code: 'ECONNRESET' });
    const read = vi.fn().mockRejectedValue(failure);
    await expect(retryConnectionRead(read)).rejects.toBe(failure);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('does not retry database validation or permission errors', async () => {
    const read = vi.fn().mockRejectedValue(Object.assign(new Error('Permission denied'), { code: '42501' }));
    await expect(retryConnectionRead(read)).rejects.toThrow('Permission denied');
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('still rejects a revoked session after reconnecting', async () => {
    const findUser = vi.fn().mockRejectedValueOnce({ cause: new Error('Connection terminated unexpectedly') }).mockResolvedValue({ id: 'user', authSubject: 'staff', email: 'staff@example.test', fullName: 'Staff', isActive: true, userRoles: [] });
    vi.spyOn(client, 'getDb').mockReturnValue({ query: { appUsers: { findFirst: findUser }, appUserCredentials: { findFirst: vi.fn().mockResolvedValue({ sessionVersion: 5 }) } } } as any);
    expect(await resolveUserBySubject('staff', 4)).toBeNull();
    expect(findUser).toHaveBeenCalledTimes(2);
  });
});
