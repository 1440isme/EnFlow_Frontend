export type StatusGroupValue =
  | 'IDEA'
  | 'BACKLOG'
  | 'TO_DO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'TESTING'
  | 'DEPLOY'
  | 'COMPLETED';

export type StatusGroupOption = {
  value: StatusGroupValue;
  label: string;
  color: string;
  order: number;
};

export const STATUS_GROUP_OPTIONS: StatusGroupOption[] = [
  { value: 'IDEA', label: 'IDEA', color: '#94a3b8', order: 1 },
  { value: 'BACKLOG', label: 'BACKLOG', color: '#64748b', order: 2 },
  { value: 'TO_DO', label: 'TO DO', color: '#3b82f6', order: 3 },
  { value: 'IN_PROGRESS', label: 'IN_PROGRESS', color: '#f59e0b', order: 4 },
  { value: 'REVIEW', label: 'REVIEW', color: '#8b5cf6', order: 5 },
  { value: 'TESTING', label: 'TESTING', color: '#06b6d4', order: 6 },
  { value: 'DEPLOY', label: 'DEPLOY', color: '#6366f1', order: 7 },
  { value: 'COMPLETED', label: 'COMPLETED', color: '#10b981', order: 8 },
];

const STATUS_GROUP_LOOKUP = new Map<string, StatusGroupOption>(
  STATUS_GROUP_OPTIONS.map((option) => [option.value, option])
);

export function normalizeStatusGroup(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_')
    .replace(/^TODO$/, 'TO_DO');
}

export function getStatusGroupOption(value: unknown): StatusGroupOption | undefined {
  return STATUS_GROUP_LOOKUP.get(normalizeStatusGroup(value) as StatusGroupValue);
}

export function getStatusGroupLabel(value: unknown): string {
  return getStatusGroupOption(value)?.label ?? String(value ?? '');
}

export function getStatusGroupColor(value: unknown): string {
  return getStatusGroupOption(value)?.color ?? '#cbd5e1';
}

