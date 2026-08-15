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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
/**
 * Direct Dev Server Middleware Plugin:
 * Seamlessly routes /api/* requests during local development
 * to our server router & Neon PostgreSQL database without extra tooling.
 */
function apiDevServerPlugin() {
    return {
        name: 'api-dev-server',
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var handler, body, chunks, chunk, e_1_1, urlObj, query_1, headers, _i, _a, _b, k, v, netlifyEvent, result, _c, _d, _e, k, v, err_1;
                var _f, req_1, req_1_1;
                var _g, e_1, _h, _j;
                var _k;
                return __generator(this, function (_l) {
                    switch (_l.label) {
                        case 0:
                            if (!((_k = req.url) === null || _k === void 0 ? void 0 : _k.startsWith('/api'))) {
                                return [2 /*return*/, next()];
                            }
                            _l.label = 1;
                        case 1:
                            _l.trys.push([1, 17, , 18]);
                            return [4 /*yield*/, import('./netlify/functions/api')];
                        case 2:
                            handler = (_l.sent()).handler;
                            body = null;
                            if (!(req.method !== 'GET' && req.method !== 'HEAD')) return [3 /*break*/, 15];
                            chunks = [];
                            _l.label = 3;
                        case 3:
                            _l.trys.push([3, 8, 9, 14]);
                            _f = true, req_1 = __asyncValues(req);
                            _l.label = 4;
                        case 4: return [4 /*yield*/, req_1.next()];
                        case 5:
                            if (!(req_1_1 = _l.sent(), _g = req_1_1.done, !_g)) return [3 /*break*/, 7];
                            _j = req_1_1.value;
                            _f = false;
                            chunk = _j;
                            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                            _l.label = 6;
                        case 6:
                            _f = true;
                            return [3 /*break*/, 4];
                        case 7: return [3 /*break*/, 14];
                        case 8:
                            e_1_1 = _l.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 14];
                        case 9:
                            _l.trys.push([9, , 12, 13]);
                            if (!(!_f && !_g && (_h = req_1.return))) return [3 /*break*/, 11];
                            return [4 /*yield*/, _h.call(req_1)];
                        case 10:
                            _l.sent();
                            _l.label = 11;
                        case 11: return [3 /*break*/, 13];
                        case 12:
                            if (e_1) throw e_1.error;
                            return [7 /*endfinally*/];
                        case 13: return [7 /*endfinally*/];
                        case 14:
                            body = Buffer.concat(chunks).toString('utf-8');
                            _l.label = 15;
                        case 15:
                            urlObj = new URL(req.url, "http://".concat(req.headers.host || 'localhost:5173'));
                            query_1 = {};
                            urlObj.searchParams.forEach(function (val, key) {
                                query_1[key] = val;
                            });
                            headers = {};
                            for (_i = 0, _a = Object.entries(req.headers); _i < _a.length; _i++) {
                                _b = _a[_i], k = _b[0], v = _b[1];
                                headers[k] = Array.isArray(v) ? v.join(', ') : v;
                            }
                            netlifyEvent = {
                                path: urlObj.pathname,
                                httpMethod: req.method || 'GET',
                                headers: headers,
                                queryStringParameters: query_1,
                                body: body,
                            };
                            return [4 /*yield*/, handler(netlifyEvent)];
                        case 16:
                            result = _l.sent();
                            res.statusCode = result.statusCode;
                            if (result.headers) {
                                for (_c = 0, _d = Object.entries(result.headers); _c < _d.length; _c++) {
                                    _e = _d[_c], k = _e[0], v = _e[1];
                                    if (v !== undefined)
                                        res.setHeader(k, v);
                                }
                            }
                            res.end(result.body);
                            return [3 /*break*/, 18];
                        case 17:
                            err_1 = _l.sent();
                            console.error('[API Dev Server Error]:', err_1);
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: { code: 'DEV_SERVER_ERROR', message: err_1.message } }));
                            return [3 /*break*/, 18];
                        case 18: return [2 /*return*/];
                    }
                });
            }); });
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
