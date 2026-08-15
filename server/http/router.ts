import { Handler, RequestContext } from './middleware';
import { errorResponse, HttpResponse } from './response';

interface RouteEntry {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

export class Router {
  private routes: RouteEntry[] = [];

  private add(method: string, path: string, handler: Handler) {
    const paramNames: string[] = [];
    const patternStr = path
      .replace(/\/+/g, '/')
      .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });

    const pattern = new RegExp(`^${patternStr}$`);
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      paramNames,
      handler,
    });
  }

  get(path: string, handler: Handler) {
    this.add('GET', path, handler);
  }

  post(path: string, handler: Handler) {
    this.add('POST', path, handler);
  }

  patch(path: string, handler: Handler) {
    this.add('PATCH', path, handler);
  }

  put(path: string, handler: Handler) {
    this.add('PUT', path, handler);
  }

  delete(path: string, handler: Handler) {
    this.add('DELETE', path, handler);
  }

  async handle(ctx: RequestContext): Promise<HttpResponse> {
    if (ctx.method.toUpperCase() === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        },
        body: '',
      };
    }

    const normalizedPath = ctx.path.replace(/\/+$/, '') || '/';

    for (const route of this.routes) {
      if (route.method !== ctx.method.toUpperCase()) continue;

      const match = normalizedPath.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, idx) => {
          params[name] = match[idx + 1] ?? '';
        });

        ctx.params = params;
        try {
          return await route.handler(ctx);
        } catch (error) {
          console.error(`[Unhandled API Error] ${ctx.method} ${ctx.path}:`, error);
          return errorResponse('INTERNAL_ERROR', 'Terjadi kesalahan pada server internal.', 500, ctx.requestId);
        }
      }
    }

    return errorResponse('NOT_FOUND', `Route [${ctx.method} ${ctx.path}] tidak ditemukan.`, 404, ctx.requestId);
  }
}
