'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronDown, Check, Clock3, Flag, Folder, GitBranch, List, ListTree, X } from 'lucide-react';
import type { Task } from '@/types/task';
import type { DashboardTask, TaskTagEntry } from '@/types/dashboard-task';
import type { StatusesResponse } from '@/types/api';
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
  statusBadgePresentation,
  statusMenuItemPresentation,
} from '@/lib/task-status-ui';
import { formatTaskPriorityLabel } from '@/lib/task-priority-ui';
import { AssigneeAvatarStack } from './AssigneeAvatarStack';
import { TaskAssigneeCell, type WorkspaceMemberOption } from './TaskAssigneeCell';
import { TaskRowTagPopover } from './TaskRowTagPopover';
import { Button } from '@/components/ui/button';
import { getTaskTags, removeTagFromTask, type TaskTagResponse } from '@/lib/task-api';
import { contrastTextOnHex } from '@/lib/tag-color';
import { isTaskDueOverdue } from '@/lib/overview-task-utils';

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

const isOverdue = (task: DashboardTask) => isTaskDueOverdue(task);

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
  selectionDisabled?: boolean;
  /** Guest/read-only: chỉ xem, không chỉnh sửa. */
  readOnly?: boolean;
  /** Trang chi tiết task — chỉ tiêu đề task là link (click vào tên mới điều hướng). */
  taskDetailHref: string;
  onStatusChange: (task: DashboardTask, statusId: number) => void;
  onPriorityChange: (task: DashboardTask, priority: Task['priority']) => void;
  dueDateDraft: string;
  onDueDateDraftChange: (value: string) => void;
  /** Gọi khi user chọn ngày (onChange). Không chỉ dựa vào blur — tránh mất thay đổi khi đổi tab trước khi blur. */
  onDueDateSave: (value: string) => void;
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
  /** Workspace scope for tag picker (workspace tags API). */
  workspaceId?: number | null;
  onAddSubtask?: (task: DashboardTask) => void;
  onTaskTagsChange?: (taskId: string, rows: TaskTagResponse[]) => void;
  statusEditable?: boolean;
  priorityEditable?: boolean;
  dueDateEditable?: boolean;
};

export function TaskTableRow({
  task,
  statuses,
  currentStatusId,
  selection,
  selectionDisabled = false,
  readOnly = false,
  taskDetailHref,
  onStatusChange,
  onPriorityChange,
  dueDateDraft,
  onDueDateDraftChange,
  onDueDateSave,
  statusSaving,
  prioritySaving,
  dueDateSaving,
  layout = 'default',
  assigneeEditable = false,
  workspaceMembersForAssignee = [],
  assigneeSaving = false,
  onAddTaskAssignee,
  onRemoveTaskAssignee,
  workspaceId = null,
  onAddSubtask,
  onTaskTagsChange,
  statusEditable = !readOnly,
  priorityEditable = !readOnly,
  dueDateEditable = !readOnly,
}: TaskTableRowProps) {
  const [removingTagId, setRemovingTagId] = useState<number | null>(null);
  const currentStatus = statuses.find((status) => status.statusId === currentStatusId) ?? null;
  const statusBadge = currentStatus
    ? statusBadgePresentation(currentStatus.statusGroup, currentStatus.color)
    : { className: 'border-slate-200 bg-slate-50 text-slate-600', style: undefined };
  const gridClass = layout === 'withAssignees' ? TASK_TABLE_GRID_WITH_ASSIGNEE : MY_TASKS_TABLE_GRID;

  const showRowQuickActions =
    !readOnly && Boolean(onAddSubtask || (workspaceId != null && workspaceId > 0 && onTaskTagsChange));

  const tagPills: TaskTagEntry[] =
    task.tagEntries && task.tagEntries.length > 0
      ? task.tagEntries
      : task.tags.slice(0, 4).map((name) => ({
          tagId: 0,
          tagName: name,
          tagColor: '#e2e8f0',
        }));

  const visibleTags = tagPills.slice(0, 4);
  const subtaskCount = task.directSubtaskCount ?? 0;

  const handleRemoveTag = async (tagId: number) => {
    if (!onTaskTagsChange || tagId < 1 || removingTagId != null) return;
    setRemovingTagId(tagId);
    try {
      await removeTagFromTask(task.taskId, tagId);
      const rows = await getTaskTags(task.taskId);
      onTaskTagsChange(task.id, rows);
    } finally {
      setRemovingTagId(null);
    }
  };

  return (
    <div
      className={cn(
        gridClass,
        'group/taskrow cursor-default select-none items-center border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50',
      )}
      role="row"
      aria-label={task.title}
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
          disabled={readOnly || selectionDisabled}
        />
      </div>

      <div className="min-w-0 pr-1">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={taskDetailHref}
                className="min-w-0 cursor-pointer truncate text-left text-[15px] font-semibold text-slate-900 underline-offset-2 transition-colors hover:text-[#0057b8] hover:underline focus-visible:rounded-sm focus-visible:text-[#0057b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057b8]/35"
                onClick={(e) => e.stopPropagation()}
              >
                {task.title}
              </Link>
              {subtaskCount > 0 ? (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600"
                  title={`${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}`}
                >
                  <GitBranch className="size-3 text-slate-500" aria-hidden />
                  {subtaskCount}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {visibleTags.map((tag) => {
                const bg = tag.tagColor?.trim() || '#94a3b8';
                const fg = contrastTextOnHex(bg);
                const canRemove = Boolean(!readOnly && onTaskTagsChange && tag.tagId >= 1);
                return (
                  <span
                    key={`${tag.tagId}-${tag.tagName}`}
                    className="group/tag relative inline-flex max-w-[10rem] items-center justify-center overflow-hidden rounded-md px-2 py-0.5 text-[10px] font-semibold leading-tight"
                    style={{ backgroundColor: bg, color: fg }}
                    title={tag.tagName}
                  >
                    <span
                      className={cn(
                        'relative z-0 min-w-0 max-w-full truncate text-center transition-opacity duration-150',
                        canRemove &&
                          'group-hover/tag:opacity-0 group-focus-within/tag:opacity-0',
                      )}
                    >
                      {tag.tagName}
                    </span>
                    {canRemove ? (
                      <button
                        type="button"
                        className={cn(
                          'pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md opacity-0 transition-opacity duration-150',
                          'group-hover/tag:pointer-events-auto group-hover/tag:opacity-100',
                          'group-focus-within/tag:pointer-events-auto group-focus-within/tag:opacity-100',
                          'focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none',
                        )}
                        style={{ backgroundColor: bg, color: fg }}
                        aria-label={`Remove tag ${tag.tagName}`}
                        disabled={removingTagId === tag.tagId}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemoveTag(tag.tagId);
                        }}
                      >
                        <X className="size-3.5 shrink-0" strokeWidth={2.75} aria-hidden />
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
          {showRowQuickActions ? (
            <div
              className={cn(
                'flex shrink-0 items-start gap-0.5 pt-0.5 opacity-0 pointer-events-none transition-opacity duration-150',
                'group-hover/taskrow:pointer-events-auto group-hover/taskrow:opacity-100',
                'group-focus-within/taskrow:pointer-events-auto group-focus-within/taskrow:opacity-100',
              )}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {onAddSubtask ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-slate-500 hover:bg-slate-200/80 hover:text-slate-900"
                  aria-label="Add subtask"
                  title="Add subtask"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSubtask(task);
                  }}
                >
                  <ListTree className="size-3.5" strokeWidth={2} />
                </Button>
              ) : null}
              {workspaceId != null && workspaceId > 0 && onTaskTagsChange ? (
                <TaskRowTagPopover
                  taskId={task.taskId}
                  workspaceId={workspaceId}
                  currentTagNames={task.tags}
                  onTagsUpdated={(rows) => onTaskTagsChange(task.id, rows)}
                />
              ) : null}
            </div>
          ) : null}
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
          {!readOnly && assigneeEditable && onAddTaskAssignee && onRemoveTaskAssignee ? (
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
              disabled={readOnly || !statusEditable || Boolean(statusSaving) || statuses.length === 0}
              className={cn(
                'inline-flex h-7 max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 text-left text-xs font-semibold shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60',
                statusBadge.className,
              )}
              style={statusBadge.style}
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
              const menu = statusMenuItemPresentation(status.statusGroup, status.color);
              const selected = status.statusId === currentStatusId;
              return (
                <DropdownMenuItem
                  key={status.statusId}
                  className="cursor-pointer gap-2 rounded-md px-2 py-1.5 focus:bg-slate-50"
              disabled={readOnly || !statusEditable}
                  onSelect={() => {
                    if (readOnly || !statusEditable) return;
                    onStatusChange(task, status.statusId);
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={menu.dotClassName}
                      style={menu.dotStyle}
                      aria-hidden
                    />
                    <span className={cn('truncate text-sm font-medium', menu.labelClassName)}>
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
              disabled={readOnly || !priorityEditable || Boolean(prioritySaving)}
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
                  disabled={readOnly || !priorityEditable}
                  onSelect={() => {
                    if (readOnly || !priorityEditable) return;
                    onPriorityChange(task, priorityOption);
                  }}
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
              isOverdue(task) ? 'text-rose-600' : 'text-slate-800',
            )}
          >
            <Calendar className="size-3.5 shrink-0 opacity-70" />
            <span className="whitespace-nowrap">{task.dueDate ? formatDateShort(task.dueDate) : '—'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Input
              type="date"
              value={dueDateDraft}
              disabled={readOnly || !dueDateEditable || Boolean(dueDateSaving)}
              onChange={(event) => {
                if (readOnly || !dueDateEditable) return;
                const v = event.target.value;
                onDueDateDraftChange(v);
                onDueDateSave(v);
              }}
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
