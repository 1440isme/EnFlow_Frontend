import type { WorkspaceResponse } from '@/types/api';
import type { WorkspaceSnapshot } from '@/types/workspace';

const STORAGE_KEY = 'enflow_workspace_snapshot';

export const DEFAULT_WORKSPACE: WorkspaceSnapshot = {
  workspaceId: null,
  ownerUserId: null,
  name: 'Workspace cá nhân',
  workspaceKey: 'my-workspace',
  description: '',
  isPrivate: false,
};

function parse(raw: string | null): WorkspaceSnapshot {
  if (!raw) return { ...DEFAULT_WORKSPACE };
  try {
    const o = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    return {
      workspaceId:
        typeof o.workspaceId === 'number' ? o.workspaceId : DEFAULT_WORKSPACE.workspaceId,
      ownerUserId:
        typeof o.ownerUserId === 'number' ? o.ownerUserId : DEFAULT_WORKSPACE.ownerUserId,
      name: typeof o.name === 'string' && o.name.trim() ? o.name : DEFAULT_WORKSPACE.name,
      workspaceKey:
        typeof o.workspaceKey === 'string' && o.workspaceKey.trim()
          ? o.workspaceKey
          : DEFAULT_WORKSPACE.workspaceKey,
      description: typeof o.description === 'string' ? o.description : '',
      isPrivate: typeof o.isPrivate === 'boolean' ? o.isPrivate : false,
    };
  } catch {
    return { ...DEFAULT_WORKSPACE };
  }
}

export function getWorkspaceSnapshot(): WorkspaceSnapshot {
  if (typeof window === 'undefined') return { ...DEFAULT_WORKSPACE };
  return parse(localStorage.getItem(STORAGE_KEY));
}

export function saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new Event('enflow-workspace-changed'));
}

export function clearWorkspaceSnapshot(): void {
  localStorage.removeItem(STORAGE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('enflow-workspace-changed'));
  }
}

export function workspaceResponseToSnapshot(w: WorkspaceResponse): WorkspaceSnapshot {
  return {
    workspaceId: w.workspaceId,
    ownerUserId: w.ownerUserId,
    name: w.name,
    workspaceKey: w.workspaceKey,
    description: w.description ?? '',
    isPrivate: w.isPrivate,
  };
}
