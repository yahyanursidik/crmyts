export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'DUPLICATE_CANDIDATE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiResponse<T = unknown> {
  data?: T;
  meta?: {
    requestId?: string;
    page?: number;
    pageSize?: number;
    total?: number;
    [key: string]: unknown;
  };
  error?: {
    code: ErrorCode;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

export function successResponse<T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
  statusCode = 200,
  headers?: Record<string, string>
): HttpResponse {
  const body: ApiResponse<T> = {
    data,
    meta: meta || {},
  };

  return {
    statusCode,
    headers: { ...DEFAULT_HEADERS, ...headers },
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  statusCode = 400,
  requestId?: string,
  details?: unknown,
  headers?: Record<string, string>
): HttpResponse {
  const body: ApiResponse = {
    error: {
      code,
      message,
      requestId,
      ...(details ? { details } : {}),
    },
  };

  return {
    statusCode,
    headers: { ...DEFAULT_HEADERS, ...headers },
    body: JSON.stringify(body),
  };
}
