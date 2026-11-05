import { vi } from "vitest";

/** Existing route fixtures run inside the new event row transaction. */
export function eventDb<T extends object>(db: T): T {
  const fixture = db as any;
  fixture.transaction ??= vi.fn(async (callback) => callback(fixture));
  fixture.execute ??= vi.fn().mockResolvedValue({ rows: [] });
  fixture.insert ??= vi
    .fn()
    .mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
  fixture.query ??= {};
  fixture.query.events ??= {
    findFirst: vi.fn().mockResolvedValue({ isPaid: false }),
  };
  return db;
}
