import type { TaskResponse, BackendTaskType } from '@/lib/task-api';
import type { Task } from '@/types/task';
import { isTaskCompleted } from '@/lib/overview-task-utils';

function startOfDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function bucketDateKey(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function lastNDaysIsoLabels(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Xu hướng tạo mới vs hoàn thành (theo ngày) — giống throughput Jira/ClickUp. */
export function createdVsCompletedDaily(
  tasks: TaskResponse[],
  days: number,
): { label: string; iso: string; created: number; completed: number }[] {
  const labels = lastNDaysIsoLabels(days);
  const set = new Set(labels);
  const created: Record<string, number> = Object.fromEntries(labels.map((d) => [d, 0]));
  const completed: Record<string, number> = Object.fromEntries(labels.map((d) => [d, 0]));

  for (const t of tasks) {
    const c = bucketDateKey(t.createdAt);
    if (c && set.has(c)) created[c] = (created[c] ?? 0) + 1;
    const comp = bucketDateKey(t.completedAt);
    if (comp && set.has(comp)) completed[comp] = (completed[comp] ?? 0) + 1;
  }

  return labels.map((iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const label = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    return {
      label,
      iso,
      created: created[iso] ?? 0,
      completed: completed[iso] ?? 0,
    };
  });
}

const TASK_TYPE_ORDER: BackendTaskType[] = ['epic', 'story', 'task', 'bug', 'subtask'];

const TASK_TYPE_VI: Record<BackendTaskType, string> = {
  epic: 'Epic',
  story: 'Story',
  task: 'Task',
  bug: 'Bug',
  subtask: 'Subtask',
};

export function taskTypeDistribution(tasks: TaskResponse[]): {
  type: BackendTaskType;
  label: string;
  count: number;
}[] {
  const counts: Partial<Record<BackendTaskType, number>> = {};
  for (const t of tasks) {
    counts[t.taskType] = (counts[t.taskType] ?? 0) + 1;
  }
  return TASK_TYPE_ORDER.map((type) => ({
    type,
    label: TASK_TYPE_VI[type],
    count: counts[type] ?? 0,
  })).filter((x) => x.count > 0);
}

/** Phân bổ theo list (trong một dự án) — workload theo cột. */
export function listBreakdown(
  raw: TaskResponse[],
  mappedByTaskId: Map<number, Task>,
): { name: string; total: number; done: number; pct: number }[] {
  const groups = new Map<string, { total: number; done: number }>();
  for (const r of raw) {
    const name = r.listName?.trim() || `List #${r.listId}`;
    const g = groups.get(name) ?? { total: 0, done: 0 };
    g.total += 1;
    const t = mappedByTaskId.get(r.taskId);
    if (t && isTaskCompleted(t)) g.done += 1;
    groups.set(name, g);
  }
  return Array.from(groups.entries())
    .map(([name, v]) => ({
      name,
      total: v.total,
      done: v.done,
      pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Phân bổ theo dự án (workspace) — portfolio. */
export function projectBreakdown(
  raw: TaskResponse[],
  mappedByTaskId: Map<number, Task>,
): { name: string; total: number; done: number; pct: number }[] {
  const groups = new Map<string, { total: number; done: number }>();
  for (const r of raw) {
    const name = r.projectName?.trim() || `Project #${r.projectId}`;
    const g = groups.get(name) ?? { total: 0, done: 0 };
    g.total += 1;
    const t = mappedByTaskId.get(r.taskId);
    if (t && isTaskCompleted(t)) g.done += 1;
    groups.set(name, g);
  }
  return Array.from(groups.entries())
    .map(([name, v]) => ({
      name,
      total: v.total,
      done: v.done,
      pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function countOverdueRaw(raw: TaskResponse[]): number {
  const today = startOfDayUtc(new Date());
  return raw.filter((t) => {
    if (t.completedAt) return false;
    if (!t.dueDate?.trim()) return false;
    const d = new Date(t.dueDate);
    if (Number.isNaN(d.getTime())) return false;
    return startOfDayUtc(d).getTime() < today.getTime();
  }).length;
}

export function countUnestimated(raw: TaskResponse[]): number {
  return raw.filter((t) => t.timeEstimateDays == null && t.timeSpentDays == null).length;
}

export function mappedByTaskId(mapped: Task[]): Map<number, Task> {
  return new Map(mapped.map((t) => [Number(t.id), t]));
}
