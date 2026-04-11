import { requestJson } from '@/lib/http';

/** Khớp TagResponse backend (camelCase). */
export type WorkspaceTagResponse = {
  tagId: number;
  workspaceId: number;
  name: string;
  color?: string | null;
};

export async function listTagsByWorkspace(workspaceId: number): Promise<WorkspaceTagResponse[]> {
  return requestJson<WorkspaceTagResponse[]>('GET', `/enflow/tags/workspaces/${workspaceId}`, {
    auth: true,
  });
}

export async function createTagInWorkspace(
  workspaceId: number,
  body: { name: string; color?: string | null },
): Promise<WorkspaceTagResponse> {
  return requestJson<WorkspaceTagResponse>('POST', `/enflow/tags/workspaces/${workspaceId}`, {
    body: {
      name: body.name.trim(),
      color: body.color?.trim() || '#94a3b8',
    },
    auth: true,
  });
}
