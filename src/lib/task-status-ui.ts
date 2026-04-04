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

/** Normalize backend statusGroup (snake_case enum or display string). */
export function normalizeBackendStatusGroupKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

/** Three UI buckets: todo · in-progress · completed. */
export type StatusVisualBucket = 'todo' | 'in-progress' | 'completed';

export function statusVisualBucketFromGroup(statusGroup: string): StatusVisualBucket {
  const g = normalizeBackendStatusGroupKey(statusGroup);
  if (g === 'completed') return 'completed';
  if (['in_progress', 'review', 'testing', 'deploy'].includes(g)) return 'in-progress';
  return 'todo';
}

/** Row badge for status dropdown — shared by My Tasks and dashboard. */
export function statusBadgeTone(statusGroup: string): string {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (b === 'in-progress') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

/** Badge: prefer API color, else Tailwind buckets. */
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

/** Dot + label classes for status menu items (fallback, no API color). */
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

/** Dot beside section header on List tab. */
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

/** Solid hex for Kanban column header dot when no API color. */
export function statusGroupHeaderDotHex(statusGroup: string): string {
  const b = statusVisualBucketFromGroup(statusGroup);
  if (b === 'completed') return '#10b981'; // emerald-500
  if (b === 'in-progress') return '#3b82f6'; // blue-500
  return '#94a3b8'; // slate-400
}

/** Column header dot: API hex if valid, else bucket fallback. */
export function statusAccentHex(statusGroup: string, colorFromApi?: string | null): string {
  return normalizeHexColor(colorFromApi) ?? statusGroupHeaderDotHex(statusGroup);
}

/** Display label for a status row; optional `name`, else derive from `statusGroup`. */
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

/** @deprecated Filter by statusId + StatusesResponse list, not a fixed array. */
export const STATUS_GROUP_ORDER: Task['status'][] = ['todo', 'in-progress', 'completed'];

/** `task.status` is the display label from the API — return as-is. */
export function formatTaskStatusLabel(status: Task['status']): string {
  const s = String(status ?? '').trim();
  return s || '—';
}
