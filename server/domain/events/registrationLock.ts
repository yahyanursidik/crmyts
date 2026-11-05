import { sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ensureEventRegistrationPhoneGuard } from "./registrationPhoneGuard";

type AppDatabase = ReturnType<typeof getDb>;
type AppTransaction = Parameters<AppDatabase["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;
export type RegistrationDatabase = AppDatabase | AppTransaction;

/** All registration channels lock the same event before checking capacity. */
export async function withEventRegistrationLock<T>(
  db: AppDatabase,
  eventId: string,
  operation: (tx: RegistrationDatabase) => Promise<T>,
): Promise<T> {
  await ensureEventRegistrationPhoneGuard(db).catch((error) =>
    console.error("Event registration phone guard unavailable:", error),
  );
  const transactional = db as unknown as {
    transaction?: (callback: (tx: AppTransaction) => Promise<T>) => Promise<T>;
  };
  // Retain compatibility with existing minimal database doubles.
  if (!transactional.transaction) return operation(db);
  return transactional.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '4s'`);
    await tx.execute(
      sql`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`,
    );
    return operation(tx);
  });
}
