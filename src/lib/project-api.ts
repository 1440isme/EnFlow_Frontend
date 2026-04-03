import { requestJson } from '@/lib/http';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';
import type { Project } from '@/types/task';

/** Khớp ProjectResponse từ backend (idProject trong JSON). */
export type ProjectResponse = {
  idProject: number;
  name: string;
  projectKey?: string | null;
  description?: string | null;
  isPrivate?: boolean;
  archived?: boolean;
  workspaceId: number;
};

/** Khớp ProjectCreatetionRequest trong backend (tên giữ nguyên để trùng contract). */
export type ProjectCreationRequest = {
  name: string;
  projectKey: string;
  description: string;
  isPrivate: boolean;
  archive: boolean;
};

/** Lấy danh sách project theo workspace. */
export async function getProjectsByWorkspace(workspaceId: number): Promise<ProjectResponse[]> {
  return requestJson<ProjectResponse[]>('GET', `/enflow/projects/workspaces/${workspaceId}`, {
    auth: true,
  });
}

export async function getProjectById(projectId: number): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>('GET', `/enflow/projects/${projectId}`, {
    auth: true,
  });
}

/** Tạo project mới trong workspace. */
export async function createProject(
  workspaceId: number,
  body: ProjectCreationRequest,
): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>('POST', `/enflow/projects/workspaces/${workspaceId}`, {
    body,
    auth: true,
  });
}

/** Cập nhật project theo id. */
export async function updateProject(
  projectId: number,
  body: ProjectCreationRequest,
): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>('PUT', `/enflow/projects/${projectId}`, {
    body,
    auth: true,
  });
}

/** Xoá project theo id. */
export async function deleteProject(projectId: number): Promise<void> {
  await requestJson<void>('DELETE', `/enflow/projects/${projectId}`, {
    auth: true,
  });
}

/**
 * Legacy helper used by dashboard tabs.
 * Returns UI-friendly project shape from current workspace snapshot.
 */
export async function listProjects(workspaceId?: number): Promise<Project[]> {
  const wsId = workspaceId ?? getWorkspaceSnapshot().workspaceId;
  if (!wsId) return [];

  const projects = await getProjectsByWorkspace(wsId);
  return projects.map((p) => ({
    id: String(p.idProject),
    name: p.name,
    key: p.projectKey ?? '',
    description: p.description ?? '',
    color: '#3b82f6',
    tasksCount: 0,
  }));
}
