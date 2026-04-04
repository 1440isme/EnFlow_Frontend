import { getAccessToken } from '@/lib/auth-token';

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
  if (useAuth) {
    const t = getAccessToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }

  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const crossOrigin = base.length > 0;

  let res: Response;
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
    const msg =
      parseErrorMessage(data) || `Lỗi ${res.status}` || 'Yêu cầu thất bại';
    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}
