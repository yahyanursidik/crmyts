/** Retry only reads interrupted by a transient connection failure, never writes. */
export async function retryConnectionRead<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    if (!isTransientConnectionError(error)) throw error;
    return read();
  }
}

export function isTransientConnectionError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const value = current as { code?: string; message?: string; cause?: unknown };
    if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', '08000', '08003', '08006', '57P01', '57P02', '57P03'].includes(value.code || '')) return true;
    if (/connection (terminated unexpectedly|closed|reset)|socket hang up|websocket.*(closed|error)/i.test(value.message || '')) return true;
    current = value.cause;
  }
  return false;
}
