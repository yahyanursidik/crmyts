import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string().default('CRM YTS'),
  VITE_API_BASE_URL: z.string().default('/api'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

// Ensure no dangerous secrets accidentally leaked to Vite client bundle
if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
  const envObj = (import.meta as any).env as Record<string, unknown>;
  if ('DATABASE_URL' in envObj || 'DATABASE_URL_DIRECT' in envObj || 'AUTH_SECRET' in envObj) {
    throw new Error('FATAL SECURITY VIOLATION: Database secret leaked to frontend client bundle!');
  }
}

export const env: ClientEnv = clientEnvSchema.parse({
  VITE_APP_NAME: (import.meta as any).env?.VITE_APP_NAME,
  VITE_API_BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL,
});
