import { describe, it, expect, vi } from 'vitest';
import { withUserContext } from '../../server/db/context';
import * as client from '../../server/db/client';

describe('Database: Row-Level Security (RLS) Context Session (CRM YTS)', () => {
  it('Executes query inside transaction with app.user_id and app.request_id local context', async () => {
    const executedQueries: any[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation((query) => {
        executedQueries.push(query);
        return Promise.resolve();
      }),
    };

    const mockDb = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    const testContext = {
      userId: '018f1111-0000-7000-8000-111111111111',
      requestId: 'req_rls_test_123',
    };

    const result = await withUserContext(testContext, async (tx) => {
      expect(tx).toBe(mockTx);
      return 'RLS_SESSION_ISOLATED';
    });

    expect(result).toBe('RLS_SESSION_ISOLATED');
    expect(mockTx.execute).toHaveBeenCalledTimes(2);
  });
});
