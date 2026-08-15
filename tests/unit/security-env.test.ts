import { describe, it, expect } from 'vitest';
import { getServerEnv } from '../../server/config/env';
import fs from 'fs';
import path from 'path';

describe('Security & Environment Configuration', () => {
  it('should validate server environment properly', () => {
    const env = getServerEnv();
    expect(env).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.AUTH_SECRET).toBeDefined();
    expect(typeof env.DATABASE_URL).toBe('string');
  });

  it('should not contain database credentials in client VITE_ prefix namespace', () => {
    const viteKeys = Object.keys(process.env).filter((key) => key.startsWith('VITE_'));
    
    // Ensure no VITE_ variables leak DB secrets
    for (const key of viteKeys) {
      expect(key).not.toContain('DATABASE');
      expect(key).not.toContain('PASSWORD');
      expect(key).not.toContain('SECRET');
    }
  });

  it('production frontend build bundle must NOT contain database connection strings or secret values', () => {
    const distPath = path.resolve(__dirname, '../../dist');
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(path.join(distPath, 'assets'));
      for (const file of files) {
        if (file.endsWith('.js')) {
          const content = fs.readFileSync(path.join(distPath, 'assets', file), 'utf-8');
          // Ensure actual database host, protocol with credentials, and secret values are absent
          expect(content).not.toContain('ep-dummy-pooler');
          expect(content).not.toContain('dummy_password');
          expect(content).not.toContain('crm-yts-local-development-secret-key');
          expect(content).not.toContain('sslmode=require');
        }
      }
    }
  });
});
