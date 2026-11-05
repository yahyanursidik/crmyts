import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@neondatabase/serverless', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@neondatabase/serverless')>();
  const { EventEmitter } = await import('node:events');
  return { ...original, Pool: class extends EventEmitter {} };
});
afterEach(() => vi.restoreAllMocks());
describe('Database idle connection recovery', () => {
  it('handles a released idle connection without terminating the worker or logging credentials', async () => {
    const { getDbPool } = await import('../../server/db/client');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = getDbPool();
    expect(pool.listenerCount('error')).toBe(1);
    expect(() =>
      pool.emit('error', new Error('test-password-must-not-be-logged')),
    ).not.toThrow();
    expect(getDbPool()).toBe(pool);
    expect(warning).toHaveBeenCalledOnce();
    expect(JSON.stringify(warning.mock.calls)).not.toContain('test-password');
  });
});
