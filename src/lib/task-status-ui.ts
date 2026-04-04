import type { CSSProperties } from 'react';
import type { StatusesResponse } from '@/types/api';
import type { Task } from '@/types/task';
import { cn } from '@/components/ui/utils';
import { normalizeHexColor } from '@/lib/tag-color';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return `rgba(15, 23, 42, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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

/** Badge row / detail: ưu tiên màu API, không thì 3 bucket Tailwind. */
export function statusBadgePresentation(
  statusGroup: string,
  colorFromApi?: string | null,
): { className: string; style?: CSSProperties } {
  const hex = normalizeHexColor(colorFromApi);
  if (hex) {
    return {
      className: 'border',
      style: {
        backgroundColor: hexToRgba(hex, 0.14),
        borderColor: hexToRgba(hex, 0.42),
        color: '#0f172a',
      },
    };
  }
  return { className: statusBadgeTone(statusGroup) };
}

/** Dot + label trong menu chọn status. */
export function statusMenuItemStyles(statusGroup: string): { dot: string; label: string } {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return { dot: 'bg-emerald-500', label: 'text-emerald-700' };
  if (b === 'in-progress') return { dot: 'bg-blue-500', label: 'text-blue-700' };
  return { dot: 'bg-slate-400', label: 'text-slate-600' };
}

export function statusMenuItemPresentation(
  statusGroup: string,
  colorFromApi?: string | null,
): { dotClassName: string; dotStyle?: CSSProperties; labelClassName: string } {
  const hex = normalizeHexColor(colorFromApi);
  if (hex) {
    return {
      dotClassName: 'size-2 shrink-0 rounded-full',
      dotStyle: { backgroundColor: hex },
      labelClassName: 'text-slate-800',
    };
  }
  const styles = statusMenuItemStyles(statusGroup);
  return {
    dotClassName: cn('size-2 shrink-0 rounded-full', styles.dot),
    labelClassName: styles.label,
  };
}

/** Dot cạnh tiêu đề section (List dashboard). */
export function sectionStatusDotClass(statusGroup: string): string {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return 'bg-emerald-500';
  if (b === 'in-progress') return 'bg-blue-500';
  return 'bg-slate-400';
}

export function sectionStatusDotPresentation(
  statusGroup: string,
  colorFromApi?: string | null,
): { className: string; style?: CSSProperties } {
  const hex = normalizeHexColor(colorFromApi);
  if (hex) {
    return { className: 'h-2.5 w-2.5 shrink-0 rounded-full', style: { backgroundColor: hex } };
  }
  return {
    className: cn('h-2.5 w-2.5 shrink-0 rounded-full', sectionStatusDotClass(statusGroup)),
  };
}

/** Màu solid cho chấm tròn header cột Kanban (3 nhóm: todo / in-progress / completed). */
export function statusGroupHeaderDotHex(statusGroup: string): string {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return '#10b981'; // emerald-500
  if (b === 'in-progress') return '#3b82f6'; // blue-500
  return '#94a3b8'; // slate-400
}

/** Chấm/header cột: hex từ API nếu hợp lệ, không thì theo bucket. */
export function statusAccentHex(statusGroup: string, colorFromApi?: string | null): string {
  return normalizeHexColor(colorFromApi) ?? statusGroupHeaderDotHex(statusGroup);
}

/** Một hàng status (list/project) — `name` tùy chọn; không có thì format từ `statusGroup`. */
export function formatStatusLabel(s: Pick<StatusesResponse, 'statusId' | 'statusGroup'> & { name?: string | null }) {
  const rawName = s.name;
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

/** @deprecated Lọc theo status dùng `statusId` + danh sách `StatusesResponse`, không dùng mảng cố định. */
export const STATUS_GROUP_ORDER: Task['status'][] = ['todo', 'in-progress', 'completed'];

/** `task.status` là nhãn hiển thị từ API — trả về nguyên văn (đã là tên cột). */
export function formatTaskStatusLabel(status: Task['status']): string {
  const s = String(status ?? '').trim();
  return s || '—';
}
