import { z } from 'zod';
import dotenv from 'dotenv';

// Load local environment files if in node environment
dotenv.config({ path: '.env.local' });
dotenv.config();

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required on the server'),
  DATABASE_URL_DIRECT: z.string().optional(),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters long'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
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
