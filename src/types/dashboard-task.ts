import type { Task } from '@/types/task';
import type { TaskResponse } from '@/lib/task-api';

/** Assignee hiển thị (dashboard): enrich từ task-assignees + users API. */
export type TaskAssigneeDisplay = {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
};

/** Task row model dùng chung My Tasks + Project Dashboard List. */
export type DashboardTask = Task & {
  taskId: number;
  projectId: number;
  listId: number;
  statusId: number;
  reporterId: number;
  startDate: string;
  completedAt: string;
  list: string;
  taskType: TaskResponse['taskType'];
  timeEstimateDays: number | null;
  updatedAt: string;
  /** Khi load đầy đủ (Project Dashboard List): dùng cho cột assignee + filter. */
  assigneesDisplay?: TaskAssigneeDisplay[];
};
