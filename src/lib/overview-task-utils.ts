import type { Task } from '@/types/task';
import { normalizeBackendStatusGroupKey } from '@/lib/task-status-ui';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseTaskDueDate(dueDate: string): Date | null {
  if (!dueDate?.trim()) return null;
  const d = new Date(dueDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Task coi là đã xong: `completedAt`, hoặc `statusGroup` backend = completed, hoặc nhãn hiển thị suy ra nhóm completed (khi thiếu statusGroup). */
export function isTaskCompleted(
  task: Pick<Task, 'status'> & { statusGroup?: string | null; completedAt?: string | null },
): boolean {
  if (task.completedAt?.trim()) return true;
  if (task.statusGroup != null && String(task.statusGroup).trim() !== '') {
    return normalizeBackendStatusGroupKey(String(task.statusGroup)) === 'completed';
  }
  return normalizeBackendStatusGroupKey(String(task.status)) === 'completed';
}

/** @deprecated dùng `isTaskCompleted` */
export function isCompletedStatus(
  status: Task['status'],
  statusGroup?: string | null,
  completedAt?: string | null,
): boolean {
  return isTaskCompleted({ status, statusGroup, completedAt });
}

/** Quá hạn: có dueDate trước hôm nay và task chưa hoàn thành. */
export function isTaskDueOverdue(
  task: Pick<Task, 'dueDate' | 'status'> & { statusGroup?: string | null; completedAt?: string | null },
): boolean {
  if (!task.dueDate?.trim()) return false;
  if (isTaskCompleted(task)) return false;
  return new Date(task.dueDate).getTime() < new Date().getTime();
}

/** Task chưa hoàn thành và có hạn trước hôm nay. */
export function isTaskOverdue(task: Task & { completedAt?: string }): boolean {
  return isTaskDueOverdue(task);
}

/**
 * Task chưa xong, có hạn trong [hôm nay, hôm nay + days] (bao gồm quá hạn trong cửa sổ — dùng kết hợp với overdue).
 * Ở Overview ta thường lọc "sắp đến hạn" = có dueDate trong 7 ngày tới và không overdue.
 */
export function isTaskDueWithinDaysFromToday(task: Task & { completedAt?: string }, days: number): boolean {
  if (isTaskCompleted(task)) return false;
  const d = parseTaskDueDate(task.dueDate);
  if (!d) return false;
  const today = startOfDay(new Date());
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  const t = startOfDay(d).getTime();
  return t >= today.getTime() && t <= end.getTime();
}

/** Có hạn trong N ngày tới, không tính task đã quá hạn (để tách KPI). */
export function isTaskDueSoonNotOverdue(task: Task & { completedAt?: string }, days: number): boolean {
  if (isTaskOverdue(task)) return false;
  return isTaskDueWithinDaysFromToday(task, days);
}

export function taskRecencyMs(task: Task): number {
  const raw = task.updatedAt || task.createdAt;
  const n = new Date(raw).getTime();
  return Number.isNaN(n) ? 0 : n;
}

export function sortTasksByRecencyDesc(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => taskRecencyMs(b) - taskRecencyMs(a));
}
