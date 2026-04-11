import { requestJson } from '@/lib/http';
import type {
  ChangePasswordRequest,
  UserPublicLookupResponse,
  UserResponse,
  UserUpdateRequest,
} from '@/types/api';

export async function getCurrentUser(): Promise<UserResponse> {
  return requestJson<UserResponse>('GET', '/enflow/users/me', { auth: true });
}

export async function getUserById(userId: number): Promise<UserResponse> {
  return requestJson<UserResponse>('GET', `/enflow/users/${userId}`, { auth: true });
}

export async function getUsersByIds(userIds: number[]): Promise<Record<number, UserResponse>> {
  const ids = Array.from(new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (ids.length === 0) return {};
  const raw = await requestJson<Record<string, UserResponse>>('POST', '/enflow/users/batch', {
    auth: true,
    body: ids,
  });
  const out: Record<number, UserResponse> = {};
  Object.entries(raw || {}).forEach(([k, v]) => {
    const n = Number(k);
    if (Number.isFinite(n)) out[n] = v;
  });
  return out;
}

export async function lookupUserByEmail(email: string): Promise<UserPublicLookupResponse> {
  const q = encodeURIComponent(email.trim());
  return requestJson<UserPublicLookupResponse>('GET', `/enflow/users/lookup?email=${q}`, {
    auth: true,
  });
}

export async function updateCurrentUser(body: UserUpdateRequest): Promise<UserResponse> {
  return requestJson<UserResponse>('PUT', '/enflow/users/me', { body, auth: true });
}

export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  await requestJson<void>('PATCH', '/enflow/users/me/change-password', {
    body,
    auth: true,
  });
}

export async function deactivateCurrentUser(): Promise<void> {
  await requestJson<void>('PATCH', '/enflow/users/me/deactivate', { auth: true });
}
