import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Direct Dev Server Middleware Plugin:
 * Seamlessly routes /api/* requests during local development
 * to our server router & Neon PostgreSQL database without extra tooling.
 */
function apiDevServerPlugin(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          return next();
        }

        try {
          // Dynamically import handler to use Node runtime environment
          const { handler } = await import('./netlify/functions/api');

          // Read request body for POST/PATCH/PUT
          let body: string | null = null;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            body = Buffer.concat(chunks).toString('utf-8');
          }

          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:5173'}`);
          const query: Record<string, string> = {};
          urlObj.searchParams.forEach((val, key) => {
            query[key] = val;
          });

          const headers: Record<string, string | undefined> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            headers[k] = Array.isArray(v) ? v.join(', ') : v;
          }

          const netlifyEvent = {
            path: urlObj.pathname,
            httpMethod: req.method || 'GET',
            headers,
            queryStringParameters: query,
            body,
          };

          const result = await handler(netlifyEvent);
          res.statusCode = result.statusCode;
          if (result.headers) {
            for (const [k, v] of Object.entries(result.headers)) {
              if (v !== undefined) res.setHeader(k, v);
            }
          }
          res.end(result.body);
        } catch (err: any) {
          console.error('[API Dev Server Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'DEV_SERVER_ERROR', message: err.message } }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevServerPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
  server: {
    port: 5173,
  },
});
