import { requestJson } from '@/lib/http';
import type {
  ProjectListCreationRequest,
  ProjectListResponse,
  ProjectListUpdateRequest,
} from '@/types/api';

export async function getListById(listId: number): Promise<ProjectListResponse> {
  return requestJson<ProjectListResponse>('GET', `/enflow/lists/${listId}`, { auth: true });
}

export async function getListsByProject(projectId: number): Promise<ProjectListResponse[]> {
  return requestJson<ProjectListResponse[]>('GET', `/enflow/lists/projects/${projectId}`, {
    auth: true,
  });
}

export async function createList(
  projectId: number,
  body: ProjectListCreationRequest,
): Promise<ProjectListResponse> {
  return requestJson<ProjectListResponse>('POST', `/enflow/lists/projects/${projectId}`, {
    body,
    auth: true,
  });
}

export async function updateList(
  listId: number,
  body: ProjectListUpdateRequest,
): Promise<ProjectListResponse> {
  return requestJson<ProjectListResponse>('PUT', `/enflow/lists/${listId}`, {
    body,
    auth: true,
  });
}

export async function deleteList(listId: number): Promise<void> {
  await requestJson<void>('DELETE', `/enflow/lists/${listId}`, { auth: true });
}
