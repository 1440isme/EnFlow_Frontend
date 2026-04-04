import type { TaskResponse, TaskAssigneeResponse, TaskTagResponse } from '@/lib/task-api';
import type { Task } from '@/types/task';
import type { DashboardTask } from '@/types/dashboard-task';
import type { StatusesResponse } from '@/types/api';
import { formatStatusLabel, normalizeBackendStatusGroupKey } from '@/lib/task-status-ui';

export const fallbackAvatar = '/placeholder.svg';

export const mapBackendPriority = (priority: TaskResponse['priority']): Task['priority'] => {
  if (priority === 'normal') return 'medium';
  return priority as Task['priority'];
};

export const mapFrontendPriorityToBackend = (priority: Task['priority']): TaskResponse['priority'] =>
  priority === 'medium' ? 'normal' : priority;

/** Fallback khi chưa có hàng status từ API (subtask / tải lỗi). */
export function inferStatusGroupFromDates(
  startDate: string | null | undefined,
  completedAt: string | null | undefined,
): string {
  if (completedAt) return 'completed';
  if (startDate && new Date(startDate).getTime() <= Date.now()) return 'in_progress';
  return 'to_do';
}

function fallbackLabelFromGroup(group: string): string {
  const g = String(group ?? '')
    .trim()
    .replace(/_/g, ' ');
  if (!g) return '—';
  return g.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function inferTaskStatusFromDates(
  startDate: string | null | undefined,
  completedAt: string | null | undefined,
): Task['status'] {
  const g = inferStatusGroupFromDates(startDate, completedAt);
  return fallbackLabelFromGroup(g);
}

/** Dùng khi đổi status: có nhóm backend `completed` → ghi completedAt. */
export function isBackendStatusGroupCompleted(statusGroup: string): boolean {
  return normalizeBackendStatusGroupKey(statusGroup) === 'completed';
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
  taskTags: TaskTagResponse[],
  statusRow?: StatusesResponse | null,
): DashboardTask {
  const primaryAssignee = pickPrimaryAssignee(assignees, currentUserId);
  const assigneeName = primaryAssignee?.fullName?.trim() || currentUserName || 'User';

  const group = statusRow
    ? String(statusRow.statusGroup ?? '')
    : inferStatusGroupFromDates(task.startDate, task.completedAt);
  const statusLabel = statusRow ? formatStatusLabel(statusRow) : fallbackLabelFromGroup(group);

  return {
    id: String(task.taskId),
    taskId: task.taskId,
    title: task.title,
    description: task.description ?? '',
    status: statusLabel,
    statusGroup: group,
    statusColor: statusRow?.color ?? null,
    priority: mapBackendPriority(task.priority),
    projectId: task.projectId,
    listId: task.listId,
    statusId: task.statusId,
    reporterId: task.reporterId,
    parentTaskId: task.parentTaskId ?? null,
    startDate: task.startDate ?? '',
    completedAt: task.completedAt ?? '',
    assignee: assigneeName,
    assigneeAvatar: fallbackAvatar,
    project: task.projectName?.trim() || task.taskCode?.trim() || `Project #${task.projectId}`,
    list: task.listName?.trim() || `List #${task.listId}`,
    dueDate: task.dueDate ?? '',
    createdAt: task.createdAt,
    tags: taskTags.map((x) => x.tagName),
    tagEntries: taskTags.map((x) => ({
      tagId: x.tagId,
      tagName: x.tagName,
      tagColor: x.tagColor || '#94a3b8',
    })),
    taskType: task.taskType,
    timeEstimateDays: task.timeEstimateDays,
    updatedAt: task.updatedAt,
  };
}
