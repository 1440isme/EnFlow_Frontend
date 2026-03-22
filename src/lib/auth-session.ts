import { setAccessToken, clearAccessToken } from '@/lib/auth-token';
import { saveUserProfile, clearUserProfile } from '@/lib/user-profile';
import {
  clearWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  workspaceResponseToSnapshot,
} from '@/lib/workspace-storage';
import { listWorkspacesByOwner } from '@/lib/workspace-api';
import type { AuthResponse } from '@/types/api';

const USER_ID_KEY = 'enflow_user_id';

export function setStoredUserId(id: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_ID_KEY, String(id));
}

export function getStoredUserId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_ID_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function syncWorkspaceFromApi(userId: number): Promise<void> {
  try {
    const list = await listWorkspacesByOwner(userId);
    const personal =
      list.find((w) => w.workspaceKey === `personal-${userId}`) ?? list[0];
    if (personal) {
      saveWorkspaceSnapshot(workspaceResponseToSnapshot(personal));
    }
  } catch {
    /* giữ snapshot local nếu offline / lỗi API */
  }
}

export async function applyAuthResponse(auth: AuthResponse): Promise<void> {
  setAccessToken(auth.accessToken);
  saveUserProfile({
    fullName: auth.user.fullName,
    email: auth.user.email,
  });
  setStoredUserId(auth.user.userId);
  await syncWorkspaceFromApi(auth.user.userId);
}

export function clearAuthSession(): void {
  clearAccessToken();
  clearUserProfile();
  clearWorkspaceSnapshot();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_ID_KEY);
  }
}
