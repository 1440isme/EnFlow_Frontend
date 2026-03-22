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
