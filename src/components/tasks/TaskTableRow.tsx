'use client';

import { Calendar, ChevronDown, Check, Clock3, Flag, Folder, List } from 'lucide-react';
import type { Task } from '@/types/task';
import type { DashboardTask } from '@/types/dashboard-task';
import type { StatusesResponse } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/ui/utils';
import {
  formatStatusLabel,
  statusBadgeTone,
  statusMenuItemStyles,
} from '@/lib/task-status-ui';
import { formatTaskPriorityLabel } from '@/lib/task-priority-ui';
import { AssigneeAvatarStack } from './AssigneeAvatarStack';
import { TaskAssigneeCell, type WorkspaceMemberOption } from './TaskAssigneeCell';

/** Cột đầu: checkbox chọn task (My Tasks + Project Dashboard List). */
export const MY_TASKS_TABLE_GRID =
  'grid w-full grid-cols-[2.75rem_minmax(0,2fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_11.75rem_9.75rem_13.5rem] gap-x-4';

/** Project Dashboard List: checkbox + Task · Project · List · Assignee · Status · Priority · Due. */
export const TASK_TABLE_GRID_WITH_ASSIGNEE =
  'grid w-full grid-cols-[2.75rem_minmax(0,2fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,1.1fr)_11.75rem_9.75rem_13.5rem] gap-x-4';

const metaColumnCell = 'min-w-0 border-l border-slate-200 pl-3';

const priorityTone: Record<Task['priority'], string> = {
  low: 'text-slate-500',
  medium: 'text-blue-600',
  normal: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-rose-600',
};

const priorityMenuItemStyles: Record<Task['priority'], { label: string; flag: string }> = {
  low: { label: 'text-slate-600', flag: 'text-slate-500' },
  medium: { label: 'text-blue-600', flag: 'text-blue-600' },
  normal: { label: 'text-blue-600', flag: 'text-blue-600' },
  high: { label: 'text-orange-600', flag: 'text-orange-600' },
  urgent: { label: 'text-rose-600', flag: 'text-rose-600' },
};

const formatDateShort = (dateValue: string) => {
  if (!dateValue) return 'No date';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isOverdue = (dateValue: string, taskStatus: Task['status']) => {
  if (!dateValue || taskStatus === 'done') return false;
  return new Date(dateValue).getTime() < new Date().getTime();
};

export type TaskTableRowSelection = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export type TaskTableRowProps = {
  task: DashboardTask;
  statuses: StatusesResponse[];
  currentStatusId: number;
  /** Checkbox chọn task (bulk actions). */
  selection: TaskTableRowSelection;
  rowSelected?: boolean;
  /** Mở chi tiết / quick edit — chỉ gọi khi double-click (tránh xung đột với chỉnh status/priority inline). */
  onRowDoubleClick: () => void;
  onStatusChange: (task: DashboardTask, statusId: number) => void;
  onPriorityChange: (task: DashboardTask, priority: Task['priority']) => void;
  dueDateDraft: string;
  onDueDateDraftChange: (value: string) => void;
  onDueDateBlur: (value: string) => void;
  statusSaving?: boolean;
  prioritySaving?: boolean;
  dueDateSaving?: boolean;
  /** `withAssignees`: cột assignee (dashboard); mặc định giống My Tasks. */
  layout?: 'default' | 'withAssignees';
  /** Dashboard List: popover chỉnh assignee (ClickUp-style). */
  assigneeEditable?: boolean;
  workspaceMembersForAssignee?: WorkspaceMemberOption[];
  assigneeSaving?: boolean;
  onAddTaskAssignee?: (task: DashboardTask, userId: number) => Promise<void>;
  onRemoveTaskAssignee?: (task: DashboardTask, userId: number) => Promise<void>;
};

export function TaskTableRow({
  task,
  statuses,
  currentStatusId,
  selection,
  rowSelected,
  onRowDoubleClick,
  onStatusChange,
  onPriorityChange,
  dueDateDraft,
  onDueDateDraftChange,
  onDueDateBlur,
  statusSaving,
  prioritySaving,
  dueDateSaving,
  layout = 'default',
  assigneeEditable = false,
  workspaceMembersForAssignee = [],
  assigneeSaving = false,
  onAddTaskAssignee,
  onRemoveTaskAssignee,
}: TaskTableRowProps) {
  const currentStatus = statuses.find((status) => status.statusId === currentStatusId) ?? null;
  const gridClass = layout === 'withAssignees' ? TASK_TABLE_GRID_WITH_ASSIGNEE : MY_TASKS_TABLE_GRID;

  return (
    <div
      tabIndex={-1}
      onDoubleClick={onRowDoubleClick}
      className={cn(
        gridClass,
        'cursor-default select-none items-center border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50',
        rowSelected && 'bg-blue-50 hover:bg-blue-50',
      )}
      aria-label={`${task.title}. Double-click to open.`}
    >
      <div
        className="flex items-center justify-center self-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selection.checked}
          onCheckedChange={(v) => selection.onCheckedChange(v === true)}
          aria-label={`Select task ${task.title}`}
          className="border-slate-300"
        />
      </div>

      <div className="min-w-0 pr-2">
        <p className="truncate text-[15px] font-semibold text-slate-900">{task.title}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {task.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="h-5 rounded-md border-slate-200 bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-700">
        <Folder className="size-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{task.project}</span>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-700">
        <List className="size-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{task.list}</span>
      </div>

      {layout === 'withAssignees' ? (
        <div className="flex min-w-0 items-center" onClick={(e) => e.stopPropagation()}>
          {assigneeEditable && onAddTaskAssignee && onRemoveTaskAssignee ? (
            <TaskAssigneeCell
              task={task}
              members={workspaceMembersForAssignee}
              busy={assigneeSaving}
              onAdd={(userId) => onAddTaskAssignee(task, userId)}
              onRemove={(userId) => onRemoveTaskAssignee(task, userId)}
            />
          ) : (
            <AssigneeAvatarStack assignees={task.assigneesDisplay} maxVisible={3} />
          )}
        </div>
      ) : null}

      <div className={cn(metaColumnCell, 'flex items-center justify-start')} onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={Boolean(statusSaving) || statuses.length === 0}
              className={cn(
                'inline-flex h-7 max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 text-left text-xs font-semibold shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60',
                currentStatus
                  ? statusBadgeTone(currentStatus.statusGroup)
                  : 'border-slate-200 bg-slate-50 text-slate-600',
              )}
            >
              <span className="min-w-0 max-w-[9.5rem] truncate whitespace-nowrap">
                {currentStatus ? formatStatusLabel(currentStatus) : '—'}
              </span>
              <ChevronDown className="size-3 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[min(100vw-2rem,14rem)] max-w-[16rem] p-1"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            {statuses.map((status) => {
              const menuStyles = statusMenuItemStyles(status.statusGroup);
              const selected = status.statusId === currentStatusId;
              return (
                <DropdownMenuItem
                  key={status.statusId}
                  className="cursor-pointer gap-2 rounded-md px-2 py-1.5 focus:bg-slate-50"
                  onSelect={() => onStatusChange(task, status.statusId)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={cn('size-2 shrink-0 rounded-full', menuStyles.dot)} aria-hidden />
                    <span className={cn('truncate text-sm font-medium', menuStyles.label)}>
                      {formatStatusLabel(status)}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="size-4 shrink-0 text-slate-400" strokeWidth={2.5} />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn(metaColumnCell, 'flex items-center justify-start')} onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={Boolean(prioritySaving)}
              className={cn(
                'inline-flex h-7 w-fit max-w-full items-center gap-1 rounded-md border border-transparent px-0.5 py-0.5 text-xs font-semibold capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60',
                priorityTone[task.priority],
              )}
            >
              <Flag className="size-3 shrink-0 opacity-90" />
              <span className="min-w-0 max-w-[6.5rem] truncate whitespace-nowrap">
                {formatTaskPriorityLabel(task.priority)}
              </span>
              <ChevronDown className="size-3 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[10.5rem] max-w-[14rem] p-1"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            {(['low', 'medium', 'high', 'urgent'] as const).map((priorityOption) => {
              const pm = priorityMenuItemStyles[priorityOption];
              const selected =
                task.priority === priorityOption ||
                (task.priority === 'normal' && priorityOption === 'medium');
              return (
                <DropdownMenuItem
                  key={priorityOption}
                  className="cursor-pointer gap-2 rounded-md px-2 py-1.5 focus:bg-slate-50"
                  onSelect={() => onPriorityChange(task, priorityOption)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Flag className={cn('size-4 shrink-0', pm.flag)} strokeWidth={2} />
                    <span className={cn('truncate text-sm font-medium', pm.label)}>
                      {formatTaskPriorityLabel(priorityOption)}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="size-4 shrink-0 text-slate-400" strokeWidth={2.5} />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn(metaColumnCell, 'flex items-center justify-start')} onClick={(e) => e.stopPropagation()}>
        <div className="inline-flex w-full max-w-full min-w-0 flex-col gap-1">
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold leading-none',
              isOverdue(task.dueDate, task.status) ? 'text-rose-600' : 'text-slate-800',
            )}
          >
            <Calendar className="size-3.5 shrink-0 opacity-70" />
            <span className="whitespace-nowrap">{task.dueDate ? formatDateShort(task.dueDate) : '—'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Input
              type="date"
              value={dueDateDraft}
              disabled={Boolean(dueDateSaving)}
              onChange={(event) => onDueDateDraftChange(event.target.value)}
              onBlur={(event) => onDueDateBlur(event.target.value)}
              className="h-8 w-[9.75rem] max-w-full shrink-0 border-slate-200 bg-slate-50/90 px-2 text-[11px] leading-none shadow-sm"
            />
            {task.timeEstimateDays != null && task.timeEstimateDays > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums text-slate-500">
                <Clock3 className="size-3 shrink-0 text-slate-400" />
                {task.timeEstimateDays}d est.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
