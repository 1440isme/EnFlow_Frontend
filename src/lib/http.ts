import { getAccessToken } from '@/lib/auth-token';
import { clearAuthSession } from '@/lib/auth-session';

type CacheEntry = { expiresAt: number; value: unknown };
const inflightGet = new Map<string, Promise<unknown>>();
const getCache = new Map<string, CacheEntry>();

function cacheKey(method: string, url: string, authHeader: string | null): string {
  // Key theo token để không lẫn user/session.
  return `${method.toUpperCase()} ${url} :: ${authHeader ?? ''}`;
}

/**
 * Base URL for API calls:
 * - Browser: empty string → same-origin paths like `/enflow/...`.
 * - NEXT_PUBLIC_API_BASE_URL: absolute API origin when calling cross-origin (CORS on backend).
 * - Server (SSR): API_PROXY_TARGET → backend origin (default http://localhost:8080).
 */
export function getApiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return '';
  }
  const internal = (process.env.API_PROXY_TARGET || 'http://localhost:8080').replace(
    /\/$/,
    ''
  );
  return internal;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function parseErrorMessage(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (typeof o.message === 'string') return o.message;
  if (typeof o.error === 'string') return o.error;
  if (Array.isArray(o.errors) && o.errors.length > 0) {
    const first = o.errors[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const f = first as Record<string, unknown>;
      if (typeof f.defaultMessage === 'string') return f.defaultMessage;
    }
  }
  if (o.errors && typeof o.errors === 'object' && !Array.isArray(o.errors)) {
    for (const v of Object.values(o.errors as Record<string, unknown>)) {
      if (typeof v === 'string') return v;
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    }
  }
  return null;
}

export type RequestJsonOptions = {
  body?: unknown;
  /** Mặc định true: gửi Bearer nếu có token. */
  auth?: boolean;
  /**
   * Cache nhẹ cho GET để tránh gọi trùng khi nhiều component/effect chạy cùng lúc
   * (đặc biệt trong React StrictMode dev).
   * - Mặc định: GET cache 3000ms, các method khác: no cache.
   * - Đặt 0 để tắt cache cho request này.
   */
  cacheTtlMs?: number;
};

export async function requestJson<T>(
  method: string,
  path: string,
  options: RequestJsonOptions = {}
): Promise<T> {
  const useAuth = options.auth !== false;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const hasBody =
    options.body !== undefined && method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  let authHeader: string | null = null;
  if (useAuth) {
    const t = getAccessToken();
    if (t) {
      authHeader = `Bearer ${t}`;
      headers['Authorization'] = authHeader;
    }
  }

  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const crossOrigin = base.length > 0;

  // Global GET de-dup + short cache (giải quyết request bị gọi 2-4 lần).
  const isGet = method.toUpperCase() === 'GET';
  const ttl =
    options.cacheTtlMs ??
    (isGet
      ? path.startsWith('/enflow/users/me')
        ? 30_000
        : path.startsWith('/enflow/workspaces/') && path.endsWith('/members')
          ? 5_000
          : path.startsWith('/enflow/projects/workspaces/')
            ? 10_000
            : path.startsWith('/enflow/tasks/projects/')
              ? 10_000
              : path.startsWith('/enflow/statuses/lists/')
                ? 30_000
                : path.startsWith('/enflow/statuses/projects/')
                  ? 30_000
                  : path.startsWith('/enflow/lists/projects/')
                    ? 30_000
                    : path.startsWith('/enflow/task-tags/tasks/')
                      ? 10_000
                      : path.startsWith('/enflow/task-assignees/users/')
                        ? 5_000
                        : 3_000
      : 0);
  if (isGet) {
    const key = cacheKey(method, url, authHeader);
    if (ttl > 0) {
      const hit = getCache.get(key);
      if (hit && hit.expiresAt > Date.now()) {
        return hit.value as T;
      }
    }
    const inFlight = inflightGet.get(key);
    if (inFlight) return (await inFlight) as T;
  }

  let res: Response;
  const doFetch = async (): Promise<T> => {
    try {
      res = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(options.body) : undefined,
        credentials: crossOrigin ? 'include' : 'same-origin',
      });
    } catch {
      throw new ApiError(
        'Không kết nối được máy chủ. Kiểm tra backend đang chạy (port 8080), biến môi trường API_PROXY_TARGET / NEXT_PUBLIC_API_BASE_URL, và khởi động lại dev server sau khi sửa .env.',
        0,
        null
      );
    }

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = { message: text };
      }
    }

    if (res.status === 204 || res.status === 205) {
      return undefined as T;
    }

    if (!res.ok) {
      if (res.status === 401 && useAuth && typeof window !== 'undefined') {
        // Token hết hạn / chưa đăng nhập: reset session và đưa user về login.
        clearAuthSession();
        const p = window.location.pathname || '';
        const next =
          p.startsWith('/login') || p.startsWith('/register') ? '' : `?next=${encodeURIComponent(p)}`;
        window.location.replace(`/login${next}`);
      }
      const msg =
        parseErrorMessage(data) || `Lỗi ${res.status}` || 'Yêu cầu thất bại';
      throw new ApiError(msg, res.status, data);
    }

    return data as T;
  };

  if (isGet) {
    const key = cacheKey(method, url, authHeader);
    const p = doFetch();
    inflightGet.set(key, p as Promise<unknown>);
    try {
      const out = await p;
      if (ttl > 0) {
        getCache.set(key, { expiresAt: Date.now() + ttl, value: out });
      }
      return out;
    } finally {
      inflightGet.delete(key);
    }
  }

  return await doFetch();
}
