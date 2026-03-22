import { requestJson } from '@/lib/http';
import type {
  WorkspaceMemberRequest,
  WorkspaceMemberResponse,
  WorkspaceMemberUpdateRequest,
  WorkspaceRequest,
  WorkspaceResponse,
  WorkspaceUpdateRequest,
} from '@/types/api';

export async function listWorkspacesByOwner(
  ownerUserId: number
): Promise<WorkspaceResponse[]> {
  return requestJson<WorkspaceResponse[]>(
    'GET',
    `/enflow/workspaces/owner/${ownerUserId}`,
    { auth: true }
  );
}

/** Danh sách workspace user có quyền truy cập (theo backend). */
export async function listWorkspaces(): Promise<WorkspaceResponse[]> {
  return requestJson<WorkspaceResponse[]>('GET', '/enflow/workspaces', { auth: true });
}

export async function createWorkspace(body: WorkspaceRequest): Promise<WorkspaceResponse> {
  return requestJson<WorkspaceResponse>('POST', '/enflow/workspaces', { body, auth: true });
}

export async function getWorkspace(workspaceId: number): Promise<WorkspaceResponse> {
  return requestJson<WorkspaceResponse>('GET', `/enflow/workspaces/${workspaceId}`, {
    auth: true,
  });
}

export async function updateWorkspace(
  workspaceId: number,
  body: WorkspaceUpdateRequest
): Promise<WorkspaceResponse> {
  return requestJson<WorkspaceResponse>('PUT', `/enflow/workspaces/${workspaceId}`, {
    body,
    auth: true,
  });
}

export async function deleteWorkspace(workspaceId: number): Promise<void> {
  await requestJson<void>('DELETE', `/enflow/workspaces/${workspaceId}`, { auth: true });
}

export async function listWorkspaceMembers(
  workspaceId: number
): Promise<WorkspaceMemberResponse[]> {
  return requestJson<WorkspaceMemberResponse[]>(
    'GET',
    `/enflow/workspaces/${workspaceId}/members`,
    { auth: true }
  );
}

export async function addWorkspaceMember(
  workspaceId: number,
  body: WorkspaceMemberRequest
): Promise<WorkspaceMemberResponse> {
  return requestJson<WorkspaceMemberResponse>(
    'POST',
    `/enflow/workspaces/${workspaceId}/members`,
    { body, auth: true }
  );
}

export async function updateWorkspaceMember(
  workspaceId: number,
  userId: number,
  body: WorkspaceMemberUpdateRequest
): Promise<WorkspaceMemberResponse> {
  return requestJson<WorkspaceMemberResponse>(
    'PUT',
    `/enflow/workspaces/${workspaceId}/members/${userId}`,
    { body, auth: true }
  );
}

export async function removeWorkspaceMember(
  workspaceId: number,
  userId: number
): Promise<void> {
  await requestJson<void>(
    'DELETE',
    `/enflow/workspaces/${workspaceId}/members/${userId}`,
    { auth: true }
  );
}
