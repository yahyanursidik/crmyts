import { sql } from 'drizzle-orm';
import { getDb } from './client';

export interface UserContext {
  userId: string;
  requestId?: string;
}

/**
 * Executes a database operation within a transaction with user context set locally (SET LOCAL).
 * Crucial for Neon serverless pooled connections to prevent session-level context leakage.
 */
export async function withUserContext<T>(
  context: UserContext,
  operation: (tx: any) => Promise<T>
): Promise<T> {
  const db = getDb();
  
  return await db.transaction(async (tx) => {
    // Set transaction-local user_id (is_local = true)
    await tx.execute(sql`SELECT set_config('app.user_id', ${context.userId}, true)`);
    
    if (context.requestId) {
      await tx.execute(sql`SELECT set_config('app.request_id', ${context.requestId}, true)`);
    }

    return await operation(tx);
  });
}
