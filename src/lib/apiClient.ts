import { env } from './env';

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
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  code: string;
  requestId?: string;
  details?: unknown;
  statusCode: number;

  constructor(message: string, code = 'INTERNAL_ERROR', statusCode = 500, requestId?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.details = details;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: ApiResponse<T>['meta'] }> {
  const baseUrl = env.VITE_API_BASE_URL.replace(/\/+$/, '');
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach client request id if not present
  if (!headers.has('X-Request-ID')) {
    headers.set('X-Request-ID', `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  }

  // Automatically attach session token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('crm_user_token');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json: ApiResponse<T> = await res.json().catch(() => ({}));

    if (!res.ok || json.error) {
      const err = json.error || { code: 'UNKNOWN_ERROR', message: res.statusText || 'Terjadi kesalahan pada server' };
      throw new ApiClientError(
        err.message,
        err.code,
        res.status,
        err.requestId,
        err.details
      );
    }

    return {
      data: json.data as T,
      meta: json.meta,
    };
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      err instanceof Error ? err.message : 'Koneksi ke server gagal. Periksa jaringan Anda.',
      'NETWORK_ERROR',
      0
    );
  }
}
