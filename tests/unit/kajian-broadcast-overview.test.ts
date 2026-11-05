import { describe, expect, it, vi } from 'vitest';
import { loadBroadcastOverview, overviewDeliveryState } from '../../server/domain/automation/kajianBroadcastOverview';

describe('Bounded broadcast overview', () => {
  it('loads counts with a single aggregate for many targets without returning recipient data', async () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({ targetId: String(index), reminderTotal: 100, h8Pending: 30, h1Pending: 100, postTotal: 50, postPending: 20 }));
    const execute = vi.fn().mockResolvedValue({ rows });
    expect(await loadBroadcastOverview({ execute } as any, Date.now(), 10)).toEqual(rows);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('keeps a partially sent batch actionable until every intended recipient is handled', () => {
    expect(overviewDeliveryState(100, 20, 500, 400, 1000)).toBe('due');
    expect(overviewDeliveryState(100, 0, 500, 400, 1000)).toBe('sent');
    expect(overviewDeliveryState(100, 20, 1100, 400, 1000)).toBe('closed');
    expect(overviewDeliveryState(0, 0, 100, 400, 1000)).toBe('not_due');
  });
});
