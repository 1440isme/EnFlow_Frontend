import type { TaskAssigneeResponse } from '@/lib/task-api';
import type { TaskAssigneeDisplay } from '@/types/dashboard-task';
import type { UserResponse } from '@/types/api';

export function sortTaskAssigneeResponses(rows: TaskAssigneeResponse[]) {
  return [...rows].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return (a.assignedAt || '').localeCompare(b.assignedAt || '');
  });
}

export function taskAssigneeRowsToDisplay(
  rows: TaskAssigneeResponse[],
  userById: Map<number, UserResponse | null | undefined>,
): TaskAssigneeDisplay[] {
  return sortTaskAssigneeResponses(rows).map((a) => {
    const u = userById.get(a.userId);
    return {
      userId: a.userId,
      displayName: u?.fullName?.trim() || a.fullName?.trim() || a.username || `User #${a.userId}`,
      avatarUrl: u?.avatarUrl ?? null,
    };
  });
}

export function assigneeUserIdsFromRows(rows: TaskAssigneeResponse[]): number[] {
  return rows.map((r) => r.userId);
}
