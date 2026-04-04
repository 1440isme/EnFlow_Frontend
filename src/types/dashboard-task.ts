import type { Task } from '@/types/task';
import type { TaskResponse } from '@/lib/task-api';

/** Assignee hiển thị (dashboard): enrich từ task-assignees + users API. */
export type TaskAssigneeDisplay = {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
};

/** Tag gắn task (đủ id để remove + màu). */
export type TaskTagEntry = {
  tagId: number;
  tagName: string;
  tagColor: string;
};

/** Task row model dùng chung My Tasks + Project Dashboard List. */
export type DashboardTask = Task & {
  taskId: number;
  projectId: number;
  listId: number;
  statusId: number;
  reporterId: number;
  parentTaskId: number | null;
  startDate: string;
  completedAt: string;
  list: string;
  taskType: TaskResponse['taskType'];
  timeEstimateDays: number | null;
  updatedAt: string;
  /** Số subtask trực tiếp (chỉ parent trong list view). */
  directSubtaskCount?: number;
  /** Tag có metadata — ưu tiên hiển thị/remove trên row. */
  tagEntries?: TaskTagEntry[];
  /** Khi load đầy đủ (Project Dashboard List): dùng cho cột assignee + filter. */
  assigneesDisplay?: TaskAssigneeDisplay[];
};
