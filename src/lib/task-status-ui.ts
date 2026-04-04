import type { StatusesResponse } from '@/types/api';
import type { Task } from '@/types/task';

/** Chuẩn hoá statusGroup từ API (enum snake_case hoặc display name). */
export function normalizeBackendStatusGroupKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

/** 3 nhóm hiển thị: To do (xám) · In progress (xanh dương) · Completed (xanh lá). */
export type StatusVisualBucket = 'todo' | 'in-progress' | 'completed';

export function statusVisualBucketFromGroup(statusGroup: string): StatusVisualBucket {
  const g = normalizeBackendStatusGroupKey(statusGroup);
  if (g === 'completed') return 'completed';
  if (['in_progress', 'review', 'testing', 'deploy'].includes(g)) return 'in-progress';
  return 'todo';
}

/** Badge trên row (dropdown status) — đồng bộ My Tasks + Dashboard. */
export function statusBadgeTone(statusGroup: string): string {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (b === 'in-progress') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

/** Dot + label trong menu chọn status. */
export function statusMenuItemStyles(statusGroup: string): { dot: string; label: string } {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return { dot: 'bg-emerald-500', label: 'text-emerald-700' };
  if (b === 'in-progress') return { dot: 'bg-blue-500', label: 'text-blue-700' };
  return { dot: 'bg-slate-400', label: 'text-slate-600' };
}

/** Dot cạnh tiêu đề section (List dashboard). */
export function sectionStatusDotClass(statusGroup: string): string {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return 'bg-emerald-500';
  if (b === 'in-progress') return 'bg-blue-500';
  return 'bg-slate-400';
}

/** Màu solid cho chấm tròn header cột Kanban (3 nhóm: todo / in-progress / completed). */
export function statusGroupHeaderDotHex(statusGroup: string): string {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return '#10b981'; // emerald-500
  if (b === 'in-progress') return '#3b82f6'; // blue-500
  return '#94a3b8'; // slate-400
}

/** Backend StatusesResponse không luôn có `name`; hiển thị từ statusGroup. */
export function formatStatusLabel(s: StatusesResponse) {
  const rawName = (s as { name?: string | null }).name;
  if (typeof rawName === 'string' && rawName.trim()) return rawName.trim();
  const g = String(s.statusGroup ?? '').replace(/_/g, ' ');
  return g.trim() || `Status #${s.statusId}`;
}

export function sortStatuses(statuses: StatusesResponse[]) {
  return [...statuses].sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER);
  });
}

export const STATUS_GROUP_ORDER: Task['status'][] = ['todo', 'in-progress', 'done'];

export function formatTaskStatusLabel(status: Task['status']): string {
  if (status === 'done') return 'Completed';
  if (status === 'in-progress') return 'In progress';
  return 'To do';
}
