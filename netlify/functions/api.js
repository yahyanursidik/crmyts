var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { Router } from '../../server/http/router';
import { extractRequestId, resolveTokenClaims } from '../../server/http/middleware';
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
import { resolveUserBySubject } from '../../server/auth/service';
var router = new Router();
// Base Health check route
router.get('/api/health', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, successResponse({
                status: 'ok',
                app: 'CRM YTS API',
                version: '2.0.0',
                timestamp: new Date().toISOString(),
            }, {
                requestId: ctx.requestId,
            })];
    });
}); });
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
export var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var requestId, path, parsedBody, authenticatedUser, tokenClaims, user, err_1, ctx, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                requestId = extractRequestId(event.headers);
                path = event.path;
                if (!path.startsWith('/api')) {
                    path = "/api".concat(path.startsWith('/') ? path : "/".concat(path));
                }
                parsedBody = null;
                if (event.body) {
                    try {
                        parsedBody = JSON.parse(event.body);
                    }
                    catch (_b) {
                        parsedBody = event.body;
                    }
                }
                authenticatedUser = undefined;
                tokenClaims = resolveTokenClaims(event.headers);
                if (!(tokenClaims === null || tokenClaims === void 0 ? void 0 : tokenClaims.authSubject)) return [3 /*break*/, 4];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, resolveUserBySubject(tokenClaims.authSubject)];
            case 2:
                user = _a.sent();
                if (user) {
                    authenticatedUser = user;
                }
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                console.error('[Session Resolve Error]:', err_1);
                return [3 /*break*/, 4];
            case 4:
                ctx = {
                    requestId: requestId,
                    method: event.httpMethod,
                    path: path,
                    headers: event.headers,
                    query: event.queryStringParameters || {},
                    body: parsedBody,
                    params: {},
                    user: authenticatedUser,
                };
                return [4 /*yield*/, router.handle(ctx)];
            case 5:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: response.body,
                    }];
        }
    });
}); };
