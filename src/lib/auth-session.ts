import { setAccessToken, clearAccessToken } from '@/lib/auth-token';
import { saveUserProfile, clearUserProfile } from '@/lib/user-profile';
import {
  clearWorkspaceSnapshot,
  getWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  workspaceResponseToSnapshot,
} from '@/lib/workspace-storage';
import { listWorkspaces, listWorkspacesByOwner } from '@/lib/workspace-api';
import { personalWorkspaceKey } from '@/lib/workspace-keys';
import { hydrateWorkspaceRoleInSnapshot } from '@/lib/workspace-role';
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
    const list = await listWorkspaces();
    const personal =
      list.find((w) => w.workspaceKey === personalWorkspaceKey(userId)) ?? list[0];
    if (personal) {
      const cur = typeof window !== 'undefined' ? getWorkspaceSnapshot() : null;
      saveWorkspaceSnapshot(
        workspaceResponseToSnapshot(
          personal,
          cur?.workspaceId === personal.workspaceId ? cur.roleInWorkspace ?? '' : '',
        ),
      );
      await hydrateWorkspaceRoleInSnapshot(personal.workspaceId);
    }
  } catch {
    try {
      const list = await listWorkspacesByOwner(userId);
      const personal =
        list.find((w) => w.workspaceKey === personalWorkspaceKey(userId)) ?? list[0];
      if (personal) {
        const cur = typeof window !== 'undefined' ? getWorkspaceSnapshot() : null;
        saveWorkspaceSnapshot(
          workspaceResponseToSnapshot(
            personal,
            cur?.workspaceId === personal.workspaceId ? cur.roleInWorkspace ?? '' : '',
          ),
        );
        await hydrateWorkspaceRoleInSnapshot(personal.workspaceId);
      }
    } catch {
      /* keep local snapshot if offline or API fails */
    }
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
