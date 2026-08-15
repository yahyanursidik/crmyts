import { describe, it, expect, vi } from 'vitest';
import { withUserContext } from '../../server/db/context';
import * as client from '../../server/db/client';

describe('Neon Serverless Transaction Context Isolation (Step 6 RLS)', () => {
  it('should execute SET LOCAL context inside transaction and isolate context', async () => {
    const executedStatements: any[] = [];

    const mockTx = {
      execute: vi.fn().mockImplementation((query) => {
        executedStatements.push(query);
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
      userId: '018f2345-6789-7abc-def0-123456789abc',
      requestId: 'req_test_123',
    };

    const result = await withUserContext<{ success: boolean; processedBy: string }>(
      testContext,
      async (tx) => {
        expect(tx).toBe(mockTx);
        return { success: true, processedBy: testContext.userId };
      }
    );

    expect(result.success).toBe(true);
    expect(result.processedBy).toBe(testContext.userId);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.execute).toHaveBeenCalledTimes(2); // app.user_id and app.request_id
  });

  it('should propagate errors from inside transaction callback', async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const mockDb = {
      transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };
    vi.spyOn(client, 'getDb').mockReturnValue(mockDb as any);

    await expect(
      withUserContext({ userId: 'usr_123' }, async () => {
        throw new Error('Database transaction aborted');
      })
    ).rejects.toThrow('Database transaction aborted');
  });
});
