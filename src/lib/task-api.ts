import { requestJson, ApiError } from '@/lib/http';
import type { Task } from '@/types/task';
import { getProjectsByWorkspace } from '@/lib/project-api';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';

const FALLBACK_AVATAR = '/placeholder.svg';

function mapBackendPriorityToFrontend(priority: BackendTaskPriority): Task['priority'] {
  // Backend dùng `normal`, UI dùng `medium`.
  if (priority === 'normal') return 'medium';
  return priority as Task['priority'];
}

function mapBackendStatusGroupToFrontendStatus(statusGroup: unknown): Task['status'] {
  const raw = String(statusGroup ?? '').trim();
  if (!raw) return 'todo';

  const s = raw.toLowerCase();
  // Completed
  if (s.includes('completed')) return 'completed';

  // Consider these "in progress" lanes
  // - backend: IN_PROGRESS / IN PROGRESS, REVIEW, TESTING, DEPLOY
  if (
    s.includes('in_progress') ||
    s.includes('in progress') ||
    s.includes('in-prog') ||
    s.includes('review') ||
    s.includes('testing') ||
    s.includes('deploy')
  ) {
    return 'in-progress';
  }

  // Todo-ish buckets
  return 'todo';
}

function taskResponseToTask(task: TaskResponse, statusById: Map<number, Task['status']>): Task {
  return {
    id: String(task.taskId),
    title: task.title,
    description: task.description ?? '',
    status: statusById.get(task.statusId) ?? 'todo',
    statusId: task.statusId,
    listId: task.listId,
    priority: mapBackendPriorityToFrontend(task.priority),
    assignee: '', // cần endpoint riêng cho assignee; placeholder cho tới khi enrich
    assigneeAvatar: FALLBACK_AVATAR,
    project: String(task.projectId), // để match với ProjectsPage
    dueDate: task.dueDate ?? '',
    createdAt: task.createdAt,
    tags: [],
  };
}

async function buildStatusByIdForListIds(listIds: number[]): Promise<Map<number, Task['status']>> {
  const uniq = Array.from(new Set(listIds)).filter((id) => Number.isFinite(id));
  const statusResponses = await Promise.all(
    uniq.map(async (listId) => {
      try {
        return await getStatusesByList(listId);
      } catch {
        return [];
      }
    }),
  );

  const byId = new Map<number, Task['status']>();
  statusResponses.flat().forEach((s) => {
    byId.set(s.statusId, mapBackendStatusGroupToFrontendStatus(s.statusGroup));
  });
  return byId;
}

export type BackendTaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type BackendTaskType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';
export type BackendStatusGroup =
  | 'idea'
  | 'backlog'
  | 'to_do'
  | 'in_progress'
  | 'review'
  | 'testing'
  | 'deploy'
  | 'completed';

export type TaskResponse = {
  taskId: number;
  projectId: number;
  projectName?: string | null;
  listId: number;
  listName?: string | null;
  statusId: number;
  parentTaskId: number | null;
  reporterId: number;
  taskCode: string | null;
  title: string;
  description: string | null;
  taskType: BackendTaskType;
  priority: BackendTaskPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  resolution: string | null;
  timeEstimateDays: number | null;
  timeSpentDays: number | null;
  points: number | null;
  position: number | null;
  isPrivate: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskUpdateRequest = Partial<{
  listId: number;
  statusId: number;
  parentTaskId: number | null;
  reporterId: number;
  taskCode: string | null;
  title: string;
  description: string | null;
  taskType: BackendTaskType;
  priority: BackendTaskPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  resolution: string | null;
  timeEstimateDays: number | null;
  timeSpentDays: number | null;
  points: number | null;
  position: number | null;
  isPrivate: boolean;
  archived: boolean;
}>;

export type TaskTagResponse = {
  taskId: number;
  tagId: number;
  tagName: string;
  tagColor: string;
};

export type TaskAssigneeResponse = {
  taskId: number;
  userId: number;
  username: string;
  fullName: string;
  email: string;
  isPrimary: boolean;
  assignedAt: string;
};

export type StatusResponse = {
  statusId: number;
  name: string;
  statusGroup: BackendStatusGroup;
  color: string | null;
  position: number | null;
  isDefault: boolean;
  listId: number;
  projectId: number;
};

export async function getTask(taskId: number): Promise<TaskResponse> {
  return requestJson<TaskResponse>('GET', `/enflow/tasks/${taskId}`, { auth: true });
}

// Legacy UI helper expects Task shape (not raw TaskResponse).
export async function getTaskById(taskId: number): Promise<Task> {
  const task = await getTask(taskId);
  return {
    id: String(task.taskId),
    title: task.title,
    description: task.description ?? '',
    status: task.completedAt ? 'done' : task.startDate ? 'in-progress' : 'todo',
    statusId: task.statusId,
    listId: task.listId,
    priority: mapBackendPriorityToFrontend(task.priority),
    assignee: 'User',
    assigneeAvatar: FALLBACK_AVATAR,
    project: task.projectName?.trim() || `Project #${task.projectId}`,
    dueDate: task.dueDate ?? '',
    createdAt: task.createdAt,
    tags: [],
  };
}

export async function getTaskTags(taskId: number): Promise<TaskTagResponse[]> {
  return requestJson<TaskTagResponse[]>('GET', `/enflow/task-tags/tasks/${taskId}`, {
    auth: true,
  });
}

export async function addTagToTask(taskId: number, tagId: number): Promise<TaskTagResponse> {
  return requestJson<TaskTagResponse>('POST', `/enflow/task-tags/tasks/${taskId}`, {
    body: { tagId },
    auth: true,
  });
}

export async function removeTagFromTask(taskId: number, tagId: number): Promise<void> {
  await requestJson<void>('DELETE', `/enflow/task-tags/tasks/${taskId}/tags/${tagId}`, {
    auth: true,
  });
}

export async function getTaskAssignees(taskId: number): Promise<TaskAssigneeResponse[]> {
  return requestJson<TaskAssigneeResponse[]>('GET', `/enflow/task-assignees/tasks/${taskId}`, {
    auth: true,
  });
}

export async function getStatusesByList(listId: number): Promise<StatusResponse[]> {
  return requestJson<StatusResponse[]>('GET', `/enflow/statuses/lists/${listId}`, {
    auth: true,
  });
}

export async function getTasksByList(listId: number): Promise<Task[]> {
  const [tasks, statusById] = await Promise.all([
    requestJson<TaskResponse[]>('GET', `/enflow/tasks/lists/${listId}`, { auth: true }),
    buildStatusByIdForListIds([listId]),
  ]);

  return (tasks ?? []).map((t) => taskResponseToTask(t, statusById));
}

/** Raw task payloads (mapper DashboardTask / filter). */
export async function listTaskResponsesByProject(projectId: number): Promise<TaskResponse[]> {
  return requestJson<TaskResponse[]>('GET', `/enflow/tasks/projects/${projectId}`, { auth: true });
}

export async function listTaskResponsesByList(listId: number): Promise<TaskResponse[]> {
  return requestJson<TaskResponse[]>('GET', `/enflow/tasks/lists/${listId}`, { auth: true });
}

export async function listTasks(projectId?: number): Promise<Task[]> {
  if (projectId !== undefined && Number.isFinite(projectId)) {
    const tasks = await requestJson<TaskResponse[]>('GET', `/enflow/tasks/projects/${projectId}`, {
      auth: true,
    });
    const statusById = await buildStatusByIdForListIds((tasks ?? []).map((t) => t.listId));
    return (tasks ?? []).map((t) => taskResponseToTask(t, statusById));
  }

  // Workspace scope: flatten tasks from all projects in current workspace.
  const wsId = getWorkspaceSnapshot().workspaceId;
  if (!wsId) return [];

  const projects = await getProjectsByWorkspace(wsId).catch(() => []);
  const tasksByProject = await Promise.all(
    projects.map(async (p) => {
      try {
        return await requestJson<TaskResponse[]>('GET', `/enflow/tasks/projects/${p.idProject}`, {
          auth: true,
        });
      } catch {
        return [];
      }
    }),
  );

  const flatTasks = tasksByProject.flat();
  const statusById = await buildStatusByIdForListIds(flatTasks.map((t) => t.listId));
  return flatTasks.map((t) => taskResponseToTask(t, statusById));
}

/** Scoped to tasks in projects that belong to the given workspace (see backend task → project → workspace). */
export async function getTasksAssignedToUser(
  userId: number,
  workspaceId: number,
): Promise<TaskAssigneeResponse[]> {
  const qs = new URLSearchParams({ workspaceId: String(workspaceId) });
  return requestJson<TaskAssigneeResponse[]>('GET', `/enflow/task-assignees/users/${userId}?${qs}`, {
    auth: true,
  });
}

export async function updateTask(
  taskId: number,
  body: TaskUpdateRequest,
): Promise<TaskResponse> {
  return requestJson<TaskResponse>('PUT', `/enflow/tasks/${taskId}`, {
    body,
    auth: true,
  });
}

export type ProjectListResponse = {
  listProjectId: number;
  name: string;
  description?: string | null;
  position?: number | null;
  isPrivate?: boolean;
  archived?: boolean;
  projectId: number;
};

export type TaskCreationRequest = {
  parentTaskId?: number | null;
  taskCode?: string | null;
  title: string;
  description?: string | null;
  taskType: BackendTaskType;
  priority: BackendTaskPriority;
  reporterId: number;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  resolution?: string | null;
  timeEstimateDays?: number | null;
  timeSpentDays?: number | null;
  points?: number | null;
  position?: number | null;
  isPrivate?: boolean;
  archived?: boolean;
};

export async function getProjectLists(projectId: number): Promise<ProjectListResponse[]> {
  return requestJson<ProjectListResponse[]>('GET', `/enflow/lists/projects/${projectId}`, {
    auth: true,
  });
}

export async function createTask(
  projectId: number,
  listId: number,
  statusId: number,
  body: TaskCreationRequest,
): Promise<TaskResponse> {
  return requestJson<TaskResponse>(
    'POST',
    `/enflow/tasks/projects/${projectId}/lists/${listId}/statuses/${statusId}`,
    { body, auth: true },
  );
}

export async function addTaskAssignee(
  taskId: number,
  body: { userId: number; isPrimary: boolean },
): Promise<TaskAssigneeResponse> {
  return requestJson<TaskAssigneeResponse>('POST', `/enflow/task-assignees/tasks/${taskId}`, {
    body,
    auth: true,
  });
}

export type TaskAssigneeUpdateRequest = {
  isPrimary?: boolean;
};

export async function updateTaskAssignee(
  taskId: number,
  userId: number,
  body: TaskAssigneeUpdateRequest,
): Promise<TaskAssigneeResponse> {
  return requestJson<TaskAssigneeResponse>(
    'PUT',
    `/enflow/task-assignees/tasks/${taskId}/users/${userId}`,
    { body, auth: true },
  );
}

export async function removeTaskAssignee(taskId: number, userId: number): Promise<void> {
  await requestJson<void>('DELETE', `/enflow/task-assignees/tasks/${taskId}/users/${userId}`, {
    auth: true,
  });
}

export async function deleteTask(taskId: number): Promise<void> {
  await requestJson<void>('DELETE', `/enflow/tasks/${taskId}`, { auth: true });
}

/** Xóa nhiều task; backend chỉ có DELETE từng id — dùng Promise.allSettled. */
export async function deleteTasksByIds(taskIds: number[]): Promise<{
  succeeded: number[];
  failed: { taskId: number; message: string }[];
}> {
  const results = await Promise.allSettled(taskIds.map((id) => deleteTask(id)));
  const succeeded: number[] = [];
  const failed: { taskId: number; message: string }[] = [];
  results.forEach((r, i) => {
    const id = taskIds[i];
    if (r.status === 'fulfilled') succeeded.push(id);
    else {
      const reason = r.reason;
      failed.push({
        taskId: id,
        message: reason instanceof ApiError ? reason.message : String(reason),
      });
    }
  });
  return { succeeded, failed };
}
