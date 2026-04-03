import { requestJson } from '@/lib/http';

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

export async function getProjectsByWorkspace(workspaceId: number): Promise<ProjectResponse[]> {
  return requestJson<ProjectResponse[]>('GET', `/enflow/projects/workspaces/${workspaceId}`, {
    auth: true,
  });
}
