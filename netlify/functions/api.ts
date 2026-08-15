import { Router } from '../../server/http/router';
import { extractRequestId, RequestContext, resolveTokenClaims } from '../../server/http/middleware';
import { successResponse } from '../../server/http/response';
import { registerAuthRoutes } from '../../server/auth/routes';
import { registerDashboardRoutes } from '../../server/domain/dashboard/routes';
import { registerPersonsRoutes } from '../../server/domain/persons/routes';
import { registerEventsRoutes } from '../../server/domain/events/routes';
import { registerTasksRoutes } from '../../server/domain/tasks/routes';
import { registerDonationsRoutes } from '../../server/domain/donations/routes';
import { registerWaqfRoutes } from '../../server/domain/waqf/routes';
import { registerInteractionsRoutes } from '../../server/domain/interactions/routes';
import { registerAttachmentsRoutes } from '../../server/domain/attachments/routes';
import { registerDataQualityRoutes } from '../../server/domain/data-quality/routes';
import { registerAuditRoutes } from '../../server/domain/audit/routes';
import { registerSettingsRoutes } from '../../server/domain/settings/routes';
import { registerReportsRoutes } from '../../server/domain/reports/routes';
import { registerAutomationRoutes } from '../../server/domain/automation/routes';
import { registerDonorsPipelineRoutes } from '../../server/domain/donors/routes';
import { registerPublicPortalRoutes } from '../../server/domain/public/routes';
import { resolveUserBySubject } from '../../server/auth/service';

interface NetlifyEvent {
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined> | null;
  body: string | null;
}

const router = new Router();

// Base Health check route
router.get('/api/health', async (ctx) => {
  return successResponse({
    status: 'ok',
    app: 'CRM YTS API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  }, {
    requestId: ctx.requestId,
  });
});

// Register All Domain Routes
registerAuthRoutes(router);
registerDashboardRoutes(router);
registerPersonsRoutes(router);
registerEventsRoutes(router);
registerTasksRoutes(router);
registerDonationsRoutes(router);
registerWaqfRoutes(router);
registerInteractionsRoutes(router);
registerAttachmentsRoutes(router);
registerDataQualityRoutes(router);
registerAuditRoutes(router);
registerSettingsRoutes(router);
registerReportsRoutes(router);
registerAutomationRoutes(router);
registerDonorsPipelineRoutes(router);
registerPublicPortalRoutes(router);

export const handler = async (event: NetlifyEvent) => {
  const requestId = extractRequestId(event.headers);

  try {
    // Normalize path if routed via Netlify redirect rewrite
    let path = event.path;
    if (!path.startsWith('/api')) {
      path = `/api${path.startsWith('/') ? path : `/${path}`}`;
    }

    let parsedBody: unknown = null;
    if (event.body) {
      try {
        parsedBody = JSON.parse(event.body);
      } catch {
        parsedBody = event.body;
      }
    }

    // Resolve user session if bearer token provided
    let authenticatedUser: RequestContext['user'] = undefined;
    const tokenClaims = resolveTokenClaims(event.headers);

    if (tokenClaims?.authSubject) {
      try {
        const user = await resolveUserBySubject(tokenClaims.authSubject);
        if (user) {
          authenticatedUser = user;
        }
      } catch (err) {
        console.error('[Session Resolve Error]:', err);
      }
    }

    const ctx: RequestContext = {
      requestId,
      method: event.httpMethod,
      path,
      headers: event.headers,
      query: event.queryStringParameters || {},
      body: parsedBody,
      params: {},
      user: authenticatedUser,
    };

    const response = await router.handle(ctx);

    return {
      statusCode: response.statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...response.headers,
      },
      body: response.body,
    };
  } catch (err: any) {
    console.error('[Netlify Function Unhandled Error]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Terjadi kesalahan sistem pada fungsi Netlify.',
          requestId,
        },
      }),
    };
  }
};
