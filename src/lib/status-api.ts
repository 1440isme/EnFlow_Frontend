import { requestJson } from '@/lib/http';
import type {
  StatusesCreationRequest,
  StatusesResponse,
  StatusesUpdateRequest,
} from '@/types/api';

export async function getStatusById(statusId: number): Promise<StatusesResponse> {
  return requestJson<StatusesResponse>('GET', `/enflow/statuses/${statusId}`, { auth: true });
}

export async function getStatusesByProject(projectId: number): Promise<StatusesResponse[]> {
  return requestJson<StatusesResponse[]>('GET', `/enflow/statuses/projects/${projectId}`, {
    auth: true,
  });
}

export async function getStatusesByList(listId: number): Promise<StatusesResponse[]> {
  return requestJson<StatusesResponse[]>('GET', `/enflow/statuses/lists/${listId}`, {
    auth: true,
  });
}

export async function createStatus(
  projectId: number,
  listId: number,
  body: StatusesCreationRequest,
): Promise<StatusesResponse> {
  return requestJson<StatusesResponse>('POST', `/enflow/statuses/projects/${projectId}/lists/${listId}`, {
    body,
    auth: true,
  });
}

export async function updateStatus(
  statusId: number,
  body: StatusesUpdateRequest,
): Promise<StatusesResponse> {
  return requestJson<StatusesResponse>('PUT', `/enflow/statuses/${statusId}`, {
    body,
    auth: true,
  });
}

export async function deleteStatus(statusId: number): Promise<void> {
  await requestJson<void>('DELETE', `/enflow/statuses/${statusId}`, {
    auth: true,
  });
}
