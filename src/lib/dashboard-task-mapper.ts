import type { TaskResponse, TaskAssigneeResponse } from '@/lib/task-api';
import type { Task } from '@/types/task';
import type { DashboardTask } from '@/types/dashboard-task';

export const fallbackAvatar = '/placeholder.svg';

export const mapBackendPriority = (priority: TaskResponse['priority']): Task['priority'] => {
  if (priority === 'normal') return 'medium';
  return priority as Task['priority'];
};

export const mapFrontendPriorityToBackend = (priority: Task['priority']): TaskResponse['priority'] =>
  priority === 'medium' ? 'normal' : priority;

export const mapBackendStatusGroup = (statusGroup: string): Task['status'] => {
  const g = String(statusGroup ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (g === 'completed') return 'done';
  if (['in_progress', 'review', 'testing', 'deploy'].includes(g)) return 'in-progress';
  return 'todo';
};

export function inferTaskStatusFromDates(
  startDate: string | null | undefined,
  completedAt: string | null | undefined,
): Task['status'] {
  if (completedAt) return 'done';
  if (startDate && new Date(startDate).getTime() <= Date.now()) return 'in-progress';
  return 'todo';
}

export const pickPrimaryAssignee = (
  assignees: TaskAssigneeResponse[],
  currentUserId: number,
) =>
  assignees.find((item) => item.isPrimary) ??
  assignees.find((item) => item.userId === currentUserId) ??
  assignees[0];

export function toDashboardTask(
  task: TaskResponse,
  assignees: TaskAssigneeResponse[],
  currentUserId: number,
  currentUserName: string,
  tagNames: string[],
): DashboardTask {
  const primaryAssignee = pickPrimaryAssignee(assignees, currentUserId);
  const assigneeName = primaryAssignee?.fullName?.trim() || currentUserName || 'User';

  return {
    id: String(task.taskId),
    taskId: task.taskId,
    title: task.title,
    description: task.description ?? '',
    status: inferTaskStatusFromDates(task.startDate, task.completedAt),
    priority: mapBackendPriority(task.priority),
    projectId: task.projectId,
    listId: task.listId,
    statusId: task.statusId,
    reporterId: task.reporterId,
    startDate: task.startDate ?? '',
    completedAt: task.completedAt ?? '',
    assignee: assigneeName,
    assigneeAvatar: fallbackAvatar,
    project: task.projectName?.trim() || task.taskCode?.trim() || `Project #${task.projectId}`,
    list: task.listName?.trim() || `List #${task.listId}`,
    dueDate: task.dueDate ?? '',
    createdAt: task.createdAt,
    tags: tagNames,
    taskType: task.taskType,
    timeEstimateDays: task.timeEstimateDays,
    updatedAt: task.updatedAt,
  };
}
