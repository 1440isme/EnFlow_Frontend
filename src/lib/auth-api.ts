import { requestJson } from '@/lib/http';
import { applyAuthResponse } from '@/lib/auth-session';
import type { AuthResponse } from '@/types/api';

export { getApiBaseUrl, ApiError, parseErrorMessage } from '@/lib/http';

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
};

export async function registerAccount(payload: RegisterPayload): Promise<AuthResponse> {
  return requestJson<AuthResponse>('POST', '/enflow/auth/register', {
    body: payload,
    auth: false,
  });
}

export type LoginPayload = {
  usernameOrEmail: string;
  password: string;
};

export async function loginAccount(payload: LoginPayload): Promise<void> {
  const data = await requestJson<AuthResponse>('POST', '/enflow/auth/login', {
    body: payload,
    auth: false,
  });
  await applyAuthResponse(data);
}
