import { requestJson } from '@/lib/http';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';

export type TaskResponse = {
  taskId: number;
  projectId: number;
  listId: number;
  statusId: number;
  parentTaskId: number | null;
  reporterId: number;
  taskCode: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  priority: TaskPriority;
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
  createdAt: string | null;
  updatedAt: string | null;
};

export type TaskTagResponse = {
  taskId: number;
  tagId: number;
  tagName: string;
  tagColor: string | null;
};

export type TaskAssigneeResponse = {
  taskId: number;
  userId: number;
  username: string;
  fullName: string;
  email: string;
  isPrimary: boolean;
  assignedAt: string | null;
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
  return requestJson<TaskAssigneeResponse[]>(
    'GET',
    `/enflow/task-assignees/tasks/${taskId}`,
    { auth: true }
  );
}
