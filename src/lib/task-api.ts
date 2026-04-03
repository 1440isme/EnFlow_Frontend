import { requestJson } from '@/lib/http';

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

export async function getTaskTags(taskId: number): Promise<TaskTagResponse[]> {
  return requestJson<TaskTagResponse[]>('GET', `/enflow/task-tags/tasks/${taskId}`, {
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

export async function getTasksAssignedToUser(userId: number): Promise<TaskAssigneeResponse[]> {
  return requestJson<TaskAssigneeResponse[]>('GET', `/enflow/task-assignees/users/${userId}`, {
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
