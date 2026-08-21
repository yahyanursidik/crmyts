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
  
  // SMTP Email Server (Kerjamail - no-reply@yts.web.id)
  SMTP_HOST: z.string().default('mx.kerjamail.co'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().default('no-reply@yts.web.id'),
  SMTP_PASS: z.string().default('ahlan1447H!'),
  SMTP_FROM: z.string().default('"Yayasan Tarbiyah Sunnah" <no-reply@yts.web.id>'),
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
