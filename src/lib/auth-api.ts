import { setAccessToken } from '@/lib/auth-token';

/**
 * - Trên trình duyệt: mặc định dùng URL tương đối `/enflow` → Next.js rewrite proxy tới backend (tránh CORS).
 * - Đặt NEXT_PUBLIC_API_BASE_URL nếu muốn gọi thẳng API (production + backend đã bật CORS).
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

function parseErrorMessage(data: unknown): string | null {
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

function pickAccessToken(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const direct = o.accessToken ?? o.token ?? o.jwt ?? o.access_token;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const nested = o.data;
  if (nested && typeof nested === 'object') {
    const n = nested as Record<string, unknown>;
    const t = n.accessToken ?? n.token ?? n.jwt ?? n.access_token;
    if (typeof t === 'string' && t.length > 0) return t;
  }
  return null;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const crossOrigin = base.length > 0;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      credentials: crossOrigin ? 'include' : 'same-origin',
    });
  } catch {
    throw new ApiError(
      'Không kết nối được máy chủ. Kiểm tra backend đang chạy (port 8080), biến API_PROXY_TARGET trong next.config, và khởi động lại dev server sau khi sửa .env.',
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

  if (!res.ok) {
    const msg =
      parseErrorMessage(data) || `Lỗi ${res.status}` || 'Yêu cầu thất bại';
    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
};

export async function registerAccount(payload: RegisterPayload): Promise<unknown> {
  return postJson<unknown>('/enflow/auth/register', payload);
}

export type LoginPayload = {
  usernameOrEmail: string;
  password: string;
};

export async function loginAccount(payload: LoginPayload): Promise<void> {
  const data = await postJson<unknown>('/enflow/auth/login', payload);
  const token = pickAccessToken(data);
  if (token) {
    setAccessToken(token);
  }
}
