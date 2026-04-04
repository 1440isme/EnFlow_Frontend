'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Task, Priority } from '@/types/task';
import type { DashboardTask } from '@/types/dashboard-task';
import type { ProjectListResponse, ProjectListWithStatusesResponse, StatusesResponse, UserResponse } from '@/types/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Calendar } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Filter, MoreVertical, Plus, Trash2 } from 'lucide-react';
import CreateStatusDialog from './CreateStatusDialog';
import DeleteStatusDialog from './DeleteStatusDialog';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { getProjectListsStatuses } from '@/lib/project-api';
import {
  getTaskAssignees,
  getTaskTags,
  listTaskResponsesByList,
  listTaskResponsesByProject,
  updateTask,
  type TaskResponse,
} from '@/lib/task-api';
import { getCurrentUser, getUserById } from '@/lib/user-api';
import { taskAssigneeRowsToDisplay } from '@/lib/task-assignee-utils';
import { toDashboardTask } from '@/lib/dashboard-task-mapper';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '../ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AssigneeAvatarStack } from '@/components/tasks/AssigneeAvatarStack';
import {
  formatStatusLabel,
  sortStatuses,
  statusAccentHex,
  statusBadgePresentation,
} from '@/lib/task-status-ui';
import { formatTaskPriorityLabel, TASK_PRIORITY_DISPLAY_ORDER } from '@/lib/task-priority-ui';
import { normalizeStatusGroup } from '@/lib/status-groups';
import { type DuePreset, dueBounds, filterDashboardTasks } from '@/lib/project-dashboard-filters';

const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  normal: 'bg-green-100 text-green-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface TaskCardProps {
  task: DashboardTask;
  onTaskClick: (taskId: string) => void;
}

type DragTaskItem = {
  id: string;
  currentStatus: string;
};

function normalizeStatusKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeCollection<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const raw = value as { content?: T[]; data?: T[] } | null | undefined;
  if (raw?.content && Array.isArray(raw.content)) return raw.content;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  return value ? ([value] as T[]) : [];
}

/** Subtasks only appear on the parent task detail, not on the board. */
function isBoardSubtask(task: DashboardTask): boolean {
  return task.taskType === 'subtask' || task.parentTaskId != null;
}

function taskBelongsToStatus(
  task: DashboardTask,
  columnStatus: StatusesResponse,
  isListScope: boolean,
  /** All loaded statuses before column dedupe — used to resolve task group by statusId */
  allStatuses: StatusesResponse[],
): boolean {
  if (isListScope) {
    return task.statusId === columnStatus.statusId;
  }
  if (task.statusId === columnStatus.statusId) return true;
  const taskRow = allStatuses.find((s) => s.statusId === task.statusId);
  if (!taskRow) return false;
  return (
    normalizeStatusGroup(taskRow.statusGroup) === normalizeStatusGroup(columnStatus.statusGroup)
  );
}

function TaskCard({ task, onTaskClick }: TaskCardProps) {
  const statusPill = statusBadgePresentation(
    task.statusGroup ?? 'to_do',
    task.statusColor ?? null,
  );
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TASK',
    item: { id: task.id, currentStatus: String(task.statusId ?? task.status) },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={(node) => {
        drag(node);
      }}
      onClick={() => onTaskClick(task.id)}
      className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer ${isDragging ? 'opacity-50' : ''
        }`}
    >
      <div className="space-y-3">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">{task.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'inline-flex max-w-[11rem] shrink-0 items-center truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight',
              statusPill.className,
            )}
            style={statusPill.style}
            title={String(task.status)}
          >
            {String(task.status)}
          </span>
          <Badge variant="secondary" className={priorityColors[task.priority]}>
            {formatTaskPriorityLabel(task.priority)}
          </Badge>
          {task.tags.slice(0, 2).map((tag, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2 min-w-0">
            {task.assigneesDisplay?.length ? (
              <>
                <AssigneeAvatarStack assignees={task.assigneesDisplay} avatarsOnly maxVisible={1} />
                <span className="text-xs truncate">
                  {task.assigneesDisplay[0]?.displayName.split(' ')[0] ?? '—'}
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-500">Unassigned</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs shrink-0">
            <Calendar className="w-3 h-3" />
            {task.dueDate ? (
              (() => {
                const d = new Date(task.dueDate);
                const ok = !Number.isNaN(d.getTime());
                return ok
                  ? d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })
                  : '—';
              })()
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ColumnProps {
  statusId: number;
  title: string;
  color?: string;
  tasks: DashboardTask[];
  canDelete?: boolean;
  onDelete?: () => void;
  onTaskClick: (taskId: string) => void;
  onDrop: (taskId: string, newStatusId: number) => void;
}

type AddStatusColumnProps = {
  onClick: () => void;
  disabled?: boolean;
};

function Column({ statusId, title, color, tasks, canDelete, onDelete, onTaskClick, onDrop }: ColumnProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'TASK',
    drop: (item: DragTaskItem) => {
      // Cast statusId to number for comparison
      if (normalizeStatusKey(item.currentStatus) !== normalizeStatusKey(statusId)) {
        onDrop(item.id, statusId);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const headerColor = color || '#d1d5db'; // default gray

  return (
    <div className="flex-1 min-w-[300px]">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* color dot indicator */}
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: headerColor }}></span>
            <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
          <div className="flex items-center gap-1">
            {canDelete && onDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                  aria-label={`Options for ${title}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="cursor-pointer text-red-600" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">{tasks.length}</span>
          </div>
        </div>
      </div>
      <div
        ref={(node) => {
          drop(node);
        }}
        className={`space-y-3 min-h-[500px] p-3 rounded-lg border-2 border-dashed transition-colors ${isOver ? 'border-[#004ba8] bg-blue-50' : 'border-gray-200 bg-gray-50/40'
          }`}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onTaskClick={onTaskClick} />
        ))}
      </div>
    </div>
  );
}

function AddStatusColumn({ onClick, disabled }: AddStatusColumnProps) {
  return (
    <div className="flex-1 min-w-[300px]">
      <div className="mb-4 h-[30px]">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full " />
            <h3 ></h3>
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={disabled}
        className="h-[500px] w-full border-2 border-dashed border-gray-200 bg-gray-50/40 text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-[#004ba8] flex flex-col gap-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm border border-gray-200">
          <Plus className="h-6 w-6" />
        </div>
        <div className="space-y-1 text-center">
          <div className="font-semibold"></div>
          <div className="text-xs text-gray-500"></div>
        </div>
      </Button>
    </div>
  );
}

type Props = {
  listId?: number | null;
};

type StatusesByList = Record<number, StatusesResponse[]>;

export default function KanbanBoardTab({ listId }: Props) {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;
  const projectNum = Number(projectId);

  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [statuses, setStatuses] = useState<StatusesResponse[]>([]);
  const [lists, setLists] = useState<ProjectListResponse[]>([]);
  const [statusesByListState, setStatusesByListState] = useState<StatusesByList>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createStatusOpen, setCreateStatusOpen] = useState(false);
  const [deleteStatusOpen, setDeleteStatusOpen] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState<StatusesResponse | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<{ userId: number; fullName: string; avatarUrl: string | null } | null>(null);

  // --- Filter state (aligned with List tab) ---
  const [filterTaskStatusIds, setFilterTaskStatusIds] = useState<number[]>([]);
  const [filterListIds, setFilterListIds] = useState<number[]>([]);
  const [filterTagNames, setFilterTagNames] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<Task['priority'][]>([]);
  const [filterAssigneeIds, setFilterAssigneeIds] = useState<number[]>([]);
  const [filterReporterIds, setFilterReporterIds] = useState<number[]>([]);
  const [duePreset, setDuePreset] = useState<DuePreset>('all');
  const [customDueFrom, setCustomDueFrom] = useState('');
  const [customDueTo, setCustomDueTo] = useState('');
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);

  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [createdByOptions, setCreatedByOptions] = useState<{ userId: number; name: string }[]>([]);
  const [assigneeUserIdsByTask, setAssigneeUserIdsByTask] = useState<Record<string, number[]>>({});

  const toggleNumber = (list: number[], id: number, set: (v: number[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const loadData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const me = await getCurrentUser();
      setCurrentUser({
        userId: me.userId,
        fullName: me.fullName?.trim() || me.username || 'You',
        avatarUrl: me.avatarUrl ?? null,
      });

      const [rawTasks, listStatusRows] = await Promise.all([
        listId ? listTaskResponsesByList(listId) : listTaskResponsesByProject(projectNum),
        getProjectListsStatuses(projectNum),
      ]);

      const listData = normalizeCollection<ProjectListWithStatusesResponse>(listStatusRows?.lists ?? []);
      const statusData = (listId
        ? listData.filter((list) => list.listProjectId === listId)
        : listData
      ).flatMap((list) => normalizeCollection<StatusesResponse>(list.statuses ?? []));

      const byList: StatusesByList = {};
      statusData.forEach((s) => {
        if (!byList[s.listId]) byList[s.listId] = [];
        byList[s.listId].push(s);
      });
      Object.keys(byList).forEach((k) => {
        byList[Number(k)] = sortStatuses(byList[Number(k)]);
      });
      setStatusesByListState(byList);
      setStatuses([...statusData].sort((a, b) => a.position - b.position));

      setLists(
        listData
          .map(({ statuses: _statuses, ...list }) => list)
          .sort((a, b) => a.position - b.position),
      );

      const userById = new Map<number, UserResponse | null | undefined>();
      userById.set(me.userId, me);

      const bundles = await Promise.all(
        (rawTasks || []).map(async (t: TaskResponse) => {
          const [tags, assignees] = await Promise.all([getTaskTags(t.taskId).catch(() => []), getTaskAssignees(t.taskId).catch(() => [])]);
          const listStatuses = byList[t.listId] ?? [];
          const matched = listStatuses.find((s) => s.statusId === t.statusId) ?? null;
          const rowBase = toDashboardTask(
            t,
            assignees,
            me.userId,
            me.fullName?.trim() || me.username || 'User',
            tags,
            matched,
          );

          return {
            row: rowBase,
            assignees,
          };
        }),
      );

      const mappedTasks: DashboardTask[] = bundles.map((b) => {
        const assigneesDisplay = taskAssigneeRowsToDisplay(b.assignees, userById);
        return { ...b.row, assigneesDisplay };
      });

      const assigneeIdsMap: Record<string, number[]> = {};
      mappedTasks.forEach((t) => {
        assigneeIdsMap[t.id] = t.assigneesDisplay?.map((a) => a.userId) ?? [];
      });
      setAssigneeUserIdsByTask(assigneeIdsMap);
      setTasks(mappedTasks);

      const reporterIds = [...new Set(mappedTasks.map((t) => t.reporterId))];
      const reporters = await Promise.all(reporterIds.map((id) => getUserById(id).catch(() => null)));
      setCreatedByOptions(
        reporters
          .filter((u): u is NonNullable<typeof u> => Boolean(u))
          .map((u) => ({ userId: u.userId, name: u.fullName?.trim() || u.username || `User #${u.userId}` }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );

      const tagSet = new Set<string>();
      mappedTasks.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
      setTagOptions(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Could not load tasks.');
      setTasks([]);
      setStatuses([]);
      setLists([]);
      setCreatedByOptions([]);
      setTagOptions([]);
      setAssigneeUserIdsByTask({});
      setStatusesByListState({});
    } finally {
      setLoading(false);
    }
  }, [listId, projectId, projectNum]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTaskClick = (taskId: string) => {
    router.push(`/app/tasks/${taskId}`);
  };

  const handleStatusCreated = async () => {
    await loadData();
  };

  const handleDeleteStatusClick = (status: StatusesResponse) => {
    setStatusToDelete(status);
    setDeleteStatusOpen(true);
  };

  const handleStatusDeleted = async () => {
    await loadData();
  };

  const dueRange = useMemo(() => dueBounds(duePreset, customDueFrom, customDueTo), [duePreset, customDueFrom, customDueTo]);

  const filterActiveCount = useMemo(() => {
    return (
      filterTaskStatusIds.length +
      filterListIds.length +
      filterTagNames.length +
      filterPriorities.length +
      filterAssigneeIds.length +
      filterReporterIds.length +
      (duePreset !== 'all' ? 1 : 0) +
      (assignedToMeOnly ? 1 : 0)
    );
  }, [assignedToMeOnly, duePreset, filterAssigneeIds.length, filterListIds.length, filterPriorities.length, filterReporterIds.length, filterTaskStatusIds.length, filterTagNames.length]);

  const statusFilterOptions = useMemo(() => {
    const uniq = new Map<number, StatusesResponse>();
    statuses.forEach((s) => {
      if (!uniq.has(s.statusId)) uniq.set(s.statusId, s);
    });
    return [...uniq.values()]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((s) => ({ value: s.statusId, label: formatStatusLabel(s) }));
  }, [statuses]);

  const listFilterOptions = useMemo(() => {
    return [...lists]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((list) => ({ id: list.listProjectId, name: list.name }));
  }, [lists]);

  const assigneeOptions = useMemo(() => {
    const m = new Map<number, string>();
    tasks.forEach((t) => {
      t.assigneesDisplay?.forEach((a) => {
        if (!m.has(a.userId)) m.set(a.userId, a.displayName);
      });
    });
    if (currentUser) m.set(currentUser.userId, currentUser.fullName);
    return Array.from(m.entries())
      .map(([userId, name]) => ({ userId, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, currentUser]);

  const boardTasks = useMemo(() => tasks.filter((t) => !isBoardSubtask(t)), [tasks]);

  const filteredTasks = useMemo(
    () =>
      filterDashboardTasks({
        tasks: boardTasks,
        assignedToMeOnly,
        currentUser,
        assigneeUserIdsByTask,
        filterTaskStatusIds,
        filterListIds,
        filterPriorities,
        filterAssigneeIds,
        filterReporterIds,
        filterTagNames,
        duePreset,
        dueRange,
      }),
    [
      boardTasks,
      assignedToMeOnly,
      currentUser,
      assigneeUserIdsByTask,
      filterTaskStatusIds,
      filterListIds,
      filterPriorities,
      filterAssigneeIds,
      filterReporterIds,
      filterTagNames,
      duePreset,
      dueRange,
    ],
  );

  const clearAllFilters = () => {
    setFilterTaskStatusIds([]);
    setFilterListIds([]);
    setFilterTagNames([]);
    setFilterPriorities([]);
    setFilterAssigneeIds([]);
    setFilterReporterIds([]);
    setDuePreset('all');
    setCustomDueFrom('');
    setCustomDueTo('');
    setAssignedToMeOnly(false);
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading board…</div>;
  }

  if (error && tasks.length === 0) {
    return <div className="p-8 text-center text-red-600 font-medium">{error}</div>;
  }

  const isListScope = Boolean(listId);
  const selectedListOptions = isListScope ? lists.filter((list) => list.listProjectId === listId) : lists;

  // Deduplicate statuses by statusGroup when in project scope
  let displayStatuses: StatusesResponse[] = [...statuses].sort((a, b) => a.position - b.position);
  if (!isListScope && displayStatuses.length > 0) {
    const seenGroups = new Set<string>();
    const uniqueByGroup: StatusesResponse[] = [];
    displayStatuses.forEach((status) => {
      const groupKey = normalizeStatusGroup(status.statusGroup);
      if (!seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        uniqueByGroup.push(status);
      }
    });
    displayStatuses = uniqueByGroup;
  }

  // Build statusGroup -> first statusId mapping for drop handler
  const statusGroupMap = new Map<string, number>();
  displayStatuses.forEach((status) => {
    const groupKey = normalizeStatusGroup(status.statusGroup);
    if (!statusGroupMap.has(groupKey)) statusGroupMap.set(groupKey, status.statusId);
  });

  const handleDrop = async (taskId: string, displayedStatusId: number) => {
    const displayedStatus = displayStatuses.find((s) => s.statusId === displayedStatusId);
    if (!displayedStatus) return;

    const groupKey = normalizeStatusGroup(displayedStatus.statusGroup);
    const actualStatusIdToUse = isListScope ? displayedStatusId : statusGroupMap.get(groupKey) ?? displayedStatusId;
    const nextLabel = formatStatusLabel(displayedStatus);
    const nextGroup = String(displayedStatus.statusGroup ?? '');
    const resolvedStatus =
      displayStatuses.find((s) => s.statusId === actualStatusIdToUse) ?? displayedStatus;
    const nextColor = resolvedStatus.color ?? null;

    const previousTasks = [...tasks];
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              statusId: actualStatusIdToUse,
              status: nextLabel,
              statusGroup: nextGroup,
              statusColor: nextColor,
            }
          : task,
      ),
    );

    try {
      await updateTask(Number(taskId), { statusId: actualStatusIdToUse });
    } catch (e) {
      console.error('Failed to update task status:', e);
      setTasks(previousTasks);
    }
  };

  return (
    <div className="space-y-6">
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        lockedProjectId={projectNum}
        defaultListId={listId ?? undefined}
        onCreated={() => void loadData()}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center" />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn('h-9 gap-2 border-slate-200', filterActiveCount > 0 && 'border-[#0057b8]/40 bg-blue-50/50')}
              >
                <Filter className="h-4 w-4" />
                Filter
                {filterActiveCount > 0 ? (
                  <Badge className="h-5 min-w-5 rounded-full bg-[#0057b8] px-1.5 text-[10px] text-white">
                    {filterActiveCount}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="max-h-[min(70vh,28rem)] w-80 overflow-y-auto p-3" align="end">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  <div className="flex max-h-32 flex-col gap-2 overflow-y-auto pr-1">
                    {statusFilterOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No statuses.</p>
                    ) : (
                      statusFilterOptions.map((s) => (
                        <label key={s.value} className="flex cursor-pointer items-start gap-2 text-slate-800">
                          <Checkbox
                            checked={filterTaskStatusIds.includes(s.value)}
                            onCheckedChange={() =>
                              setFilterTaskStatusIds((prev) =>
                                prev.includes(s.value) ? prev.filter((x) => x !== s.value) : [...prev, s.value],
                              )
                            }
                          />
                          <span className="leading-tight">{s.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {listId ? null : (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">List</p>
                    <div className="flex max-h-28 flex-col gap-2 overflow-y-auto pr-1">
                      {listFilterOptions.length === 0 ? (
                        <p className="text-xs text-slate-500">No lists in project.</p>
                      ) : (
                        listFilterOptions.map((listOption) => (
                          <label key={listOption.id} className="flex cursor-pointer items-center gap-2 text-slate-800">
                            <Checkbox
                              checked={filterListIds.includes(listOption.id)}
                              onCheckedChange={() => toggleNumber(filterListIds, listOption.id, setFilterListIds)}
                            />
                            <span className="truncate">{listOption.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>
                  <div className="flex max-h-28 flex-col gap-2 overflow-y-auto pr-1">
                    {tagOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No tags on tasks.</p>
                    ) : (
                      tagOptions.map((tag) => (
                        <label key={tag} className="flex cursor-pointer items-center gap-2 text-slate-800">
                          <Checkbox
                            checked={filterTagNames.includes(tag)}
                            onCheckedChange={() =>
                              setFilterTagNames((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]))
                            }
                          />
                          <span className="truncate">{tag}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</p>
                  <select
                    value={duePreset}
                    onChange={(e) => setDuePreset(e.target.value as DuePreset)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                  >
                    <option value="all">Any</option>
                    <option value="no_due">No due date</option>
                    <option value="has_due">Has due date</option>
                    <option value="overdue">Overdue</option>
                    <option value="today">Due today</option>
                    <option value="week">Due this week</option>
                    <option value="month">Due this month</option>
                    <option value="custom">Custom range</option>
                  </select>
                  {duePreset === 'custom' ? (
                    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                      <div>
                        <span className="text-xs text-slate-500">From</span>
                        <input
                          type="date"
                          value={customDueFrom}
                          onChange={(e) => setCustomDueFrom(e.target.value)}
                          className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">To</span>
                        <input
                          type="date"
                          value={customDueTo}
                          onChange={(e) => setCustomDueTo(e.target.value)}
                          className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</p>
                  <div className="flex flex-col gap-2">
                    {TASK_PRIORITY_DISPLAY_ORDER.map((p) => (
                      <label key={p} className="flex cursor-pointer items-center gap-2 text-slate-800">
                        <Checkbox
                          checked={filterPriorities.includes(p)}
                          onCheckedChange={() =>
                            setFilterPriorities((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
                          }
                        />
                        <span>{formatTaskPriorityLabel(p)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assignee</p>
                  <div className="flex max-h-28 flex-col gap-2 overflow-y-auto pr-1">
                    {assigneeOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No assignees found.</p>
                    ) : (
                      assigneeOptions.map((a) => (
                        <label key={a.userId} className="flex cursor-pointer items-center gap-2 text-slate-800">
                          <Checkbox
                            checked={filterAssigneeIds.includes(a.userId)}
                            onCheckedChange={() => toggleNumber(filterAssigneeIds, a.userId, setFilterAssigneeIds)}
                          />
                          <span className="truncate">{a.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Created by</p>
                  <div className="flex max-h-28 flex-col gap-2 overflow-y-auto pr-1">
                    {createdByOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">No reporters resolved.</p>
                    ) : (
                      createdByOptions.map((u) => (
                        <label key={u.userId} className="flex cursor-pointer items-center gap-2 text-slate-800">
                          <Checkbox
                            checked={filterReporterIds.includes(u.userId)}
                            onCheckedChange={() => toggleNumber(filterReporterIds, u.userId, setFilterReporterIds)}
                          />
                          <span className="truncate">{u.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <Button type="button" variant="ghost" className="h-8 w-full text-xs text-slate-600" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant={assignedToMeOnly ? 'default' : 'outline'}
            className="h-9 w-9 p-0"
            onClick={() => setAssignedToMeOnly((x) => !x)}
            title="Assigned to me"
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={currentUser?.avatarUrl ?? undefined} alt={currentUser?.fullName || 'Me'} />
              <AvatarFallback className="text-[10px]">
                {(currentUser?.fullName || 'ME')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join('')}
              </AvatarFallback>
            </Avatar>
          </Button>

          <Button type="button" className="gap-2 bg-[#0057b8] hover:bg-[#00489a]" onClick={() => setCreateTaskOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </div>

      <DndProvider backend={HTML5Backend}>
        <div className="flex gap-6 overflow-x-auto pb-4 items-stretch">
          {displayStatuses.length > 0 ? (
            <>
              {displayStatuses.map((status) => {
                const columnTasks = filteredTasks.filter((task) =>
                  taskBelongsToStatus(task, status, isListScope, statuses),
                );
                const title = formatStatusLabel(status);
                const dotColor = statusAccentHex(String(status.statusGroup ?? ''), status.color);
                return (
                  <Column
                    key={status.statusId}
                    statusId={status.statusId}
                    title={title}
                    color={dotColor}
                    tasks={columnTasks}
                    canDelete
                    onDelete={() => handleDeleteStatusClick(status)}
                    onTaskClick={handleTaskClick}
                    onDrop={handleDrop}
                  />
                );
              })}
              <AddStatusColumn onClick={() => setCreateStatusOpen(true)} disabled={!isListScope} />
            </>
          ) : (
            <div className="flex-1 min-w-[300px] rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              This Project is empty
            </div>
          )}
        </div>
      </DndProvider>

      <CreateStatusDialog
        open={createStatusOpen}
        onOpenChange={setCreateStatusOpen}
        projectId={projectNum}
        lists={selectedListOptions}
        existingStatuses={statuses}
        onCreated={handleStatusCreated}
      />

      <DeleteStatusDialog
        open={deleteStatusOpen}
        onOpenChange={setDeleteStatusOpen}
        status={statusToDelete}
        onDeleted={handleStatusDeleted}
      />
    </div>
  );
}
