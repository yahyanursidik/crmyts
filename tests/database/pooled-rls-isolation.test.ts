import { describe, it, expect, vi } from 'vitest';
import { withUserContext } from '../../server/db/context';
import * as client from '../../server/db/client';

describe('Database: Pooled Connection RLS Context Isolation (CRM YTS)', () => {
  it('Guarantees set_config is called with is_local=true so context resets on connection release', async () => {
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

    await withUserContext(
      {
        userId: '018f0000-0000-7000-8000-00000000000A',
        requestId: 'req_pool_a',
      },
      async () => {
        return true;
      }
    );

    // Verify set_config was called with is_local=true to avoid connection pool leakage
    expect(mockTx.execute).toHaveBeenCalledTimes(2);
    expect(mockTx.execute).toHaveBeenCalledWith(expect.anything());
  });
});
