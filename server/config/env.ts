import { z } from 'zod';
import dotenv from 'dotenv';

// Load local environment files if in node environment
dotenv.config({ path: '.env.local' });
dotenv.config();

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().default(''),
  DATABASE_URL_DIRECT: z.string().optional(),
  AUTH_SECRET: z.string().default('tarbiyah-sunnah-crm-jwt-secret-key-production-2026-auth'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  
  // Mailketing transactional email API. Keep secrets only in the runtime environment.
  MAILKETING_API_ENDPOINT: z.string().url().default('https://api.mailketing.co.id/api/v2/send'),
  MAILKETING_API_TOKEN: z.string().default(''),
  MAILKETING_FROM_NAME: z.string().min(1).default('Yayasan Tarbiyah Sunnah'),
  MAILKETING_FROM_EMAIL: z.string().email().default('no-reply@yts.web.id'),
  // A single server-side ceiling for all broadcast campaigns in one WIB calendar day.
  MAILKETING_BROADCAST_DAILY_LIMIT: z.coerce.number().int().min(1).max(400).default(400),
  // This secret protects the inbound Mailketing webhook because its current webhook
  // protocol does not include a provider signature.
  MAILKETING_WEBHOOK_SECRET: z.string().refine((value) => value === '' || value.length >= 16, {
    message: 'MAILKETING_WEBHOOK_SECRET minimal 16 karakter.',
  }).default(''),

  // Contabo S3 Cloud Storage Vault & Public CDN URL
  S3_ENDPOINT: z.string().url().default('https://sin1.contabostorage.com'),
  S3_REGION: z.string().default('SIN'),
  S3_BUCKET: z.string().default('crmyts'),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_PUBLIC_URL_PREFIX: z.string().url().default('https://sin1.contabostorage.com/68671c4afe7c45fba062c1c65a776541:crmyts'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _serverEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!_serverEnv) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      console.error('❌ Invalid server environment configuration:', result.error.format());
      throw new Error('Server environment validation failed');
    }
    _serverEnv = result.data;
  }
  return _serverEnv;
}

/** Test-only cache reset for environment-dependent integrations. */
export function resetServerEnvCache(): void {
  _serverEnv = null;
}
