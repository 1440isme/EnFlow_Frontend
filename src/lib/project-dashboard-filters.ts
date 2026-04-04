import type { Task } from '@/types/task';
import type { DashboardTask } from '@/types/dashboard-task';

/** Đồng bộ với tab List / Board. */
export type DuePreset = 'all' | 'no_due' | 'has_due' | 'overdue' | 'today' | 'week' | 'month' | 'custom';

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isOverdue(dateValue: string, taskStatus: Task['status']): boolean {
  if (!dateValue || taskStatus === 'done') return false;
  return new Date(dateValue).getTime() < new Date().getTime();
}

export function dueBounds(
  preset: DuePreset,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } {
  if (preset === 'custom') return { from: customFrom || null, to: customTo || null };
  if (preset === 'all' || preset === 'no_due' || preset === 'has_due' || preset === 'overdue') {
    return { from: null, to: null };
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'today') {
    const y = formatYmd(today);
    return { from: y, to: y };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: formatYmd(start), to: formatYmd(end) };
  }
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: formatYmd(monday), to: formatYmd(sunday) };
}

export type DashboardTaskFilterInput = {
  tasks: DashboardTask[];
  assignedToMeOnly: boolean;
  currentUser: { userId: number } | null;
  assigneeUserIdsByTask: Record<string, number[]>;
  filterStatusIds: Task['status'][];
  filterListIds: number[];
  filterPriorities: Task['priority'][];
  filterAssigneeIds: number[];
  filterReporterIds: number[];
  filterTagNames: string[];
  duePreset: DuePreset;
  dueRange: { from: string | null; to: string | null };
};

/** Cùng rule với `filteredTasks` trong KanbanBoardTab / TaskListTab. */
export function filterDashboardTasks(input: DashboardTaskFilterInput): DashboardTask[] {
  const {
    tasks,
    assignedToMeOnly,
    currentUser,
    assigneeUserIdsByTask,
    filterStatusIds,
    filterListIds,
    filterPriorities,
    filterAssigneeIds,
    filterReporterIds,
    filterTagNames,
    duePreset,
    dueRange,
  } = input;

  return tasks.filter((task) => {
    if (assignedToMeOnly && currentUser) {
      const ids = assigneeUserIdsByTask[task.id] ?? [];
      if (!ids.includes(currentUser.userId)) return false;
    }
    if (filterStatusIds.length > 0 && !filterStatusIds.includes(task.status)) return false;
    if (filterListIds.length > 0 && !filterListIds.includes(task.listId)) return false;
    if (filterPriorities.length > 0 && !filterPriorities.includes(task.priority)) return false;
    if (filterAssigneeIds.length > 0) {
      const ids = assigneeUserIdsByTask[task.id] ?? [];
      if (!ids.some((id) => filterAssigneeIds.includes(id))) return false;
    }
    if (filterReporterIds.length > 0 && !filterReporterIds.includes(task.reporterId)) return false;
    if (filterTagNames.length > 0) {
      const has = filterTagNames.some((tag) => task.tags.includes(tag));
      if (!has) return false;
    }
    if (duePreset === 'no_due' && task.dueDate) return false;
    if (duePreset === 'has_due' && !task.dueDate) return false;
    if (duePreset === 'overdue' && !isOverdue(task.dueDate, task.status)) return false;
    if (['today', 'week', 'month', 'custom'].includes(duePreset) && task.dueDate) {
      const due = new Date(task.dueDate);
      if (Number.isNaN(due.getTime())) return false;
      if (dueRange.from) {
        const from = new Date(`${dueRange.from}T00:00:00`);
        if (due < from) return false;
      }
      if (dueRange.to) {
        const to = new Date(`${dueRange.to}T23:59:59`);
        if (due > to) return false;
      }
    }
    if (['today', 'week', 'month', 'custom'].includes(duePreset) && !task.dueDate) return false;
    return true;
  });
}

/** Chuẩn hóa dueDate task -> key YYYY-MM-DD (local). */
export function taskDueDateKey(dueDate: string | null | undefined): string | null {
  if (!dueDate?.trim()) return null;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return null;
  return formatYmd(d);
}
