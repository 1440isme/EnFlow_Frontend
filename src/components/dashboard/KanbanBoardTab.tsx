'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Task, Priority } from '@/types/task';
import type { DashboardTask } from '@/types/dashboard-task';
import type { ProjectListResponse, StatusesResponse, UserResponse } from '@/types/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Calendar } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Filter, Plus } from 'lucide-react';
import CreateStatusDialog from './CreateStatusDialog';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { getListsByProject } from '@/lib/list-api';
import { getStatusesByList, getStatusesByProject } from '@/lib/status-api';
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
import { mapBackendStatusGroup, toDashboardTask } from '@/lib/dashboard-task-mapper';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '../ui/utils';
import { AssigneeAvatarStack } from '@/components/tasks/AssigneeAvatarStack';
import { STATUS_GROUP_ORDER, formatTaskStatusLabel, sortStatuses, statusGroupHeaderDotHex } from '@/lib/task-status-ui';
import { formatTaskPriorityLabel, TASK_PRIORITY_DISPLAY_ORDER } from '@/lib/task-priority-ui';

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

function taskBelongsToStatus(task: DashboardTask, status: StatusesResponse): boolean {
  // In project scope we dedupe columns by `statusGroup`, so compare by visual bucket.
  if (task.statusId === status.statusId) return true;
  const bucket = mapBackendStatusGroup(String(status.statusGroup ?? ''));
  return task.status === bucket;
}

function TaskCard({ task, onTaskClick }: TaskCardProps) {
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
      className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="space-y-3">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">{task.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
  onTaskClick: (taskId: string) => void;
  onDrop: (taskId: string, newStatusId: number) => void;
}

type AddStatusColumnProps = {
  onClick: () => void;
  disabled?: boolean;
};

function Column({ statusId, title, color, tasks, onTaskClick, onDrop }: ColumnProps) {
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             {/* color dot indicator */}
             <span className="w-3 h-3 rounded-full" style={{ backgroundColor: headerColor }}></span>
             <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {tasks.length}
          </span>
        </div>
      </div>
      <div
        ref={(node) => {
          drop(node);
        }}
        className={`space-y-3 min-h-[500px] p-3 rounded-lg border-2 border-dashed transition-colors ${
          isOver ? 'border-[#004ba8] bg-blue-50' : 'border-gray-200 bg-gray-50/40'
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
        <div className="mb-4 h-[30px]"> {/* 👈 thêm height */}
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

// --- Local filter helpers (đồng bộ hành vi với tab `List`) ---
type DuePreset = 'all' | 'no_due' | 'has_due' | 'overdue' | 'today' | 'week' | 'month' | 'custom';

const formatYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isOverdue = (dateValue: string, taskStatus: Task['status']) => {
  if (!dateValue || taskStatus === 'done') return false;
  return new Date(dateValue).getTime() < new Date().getTime();
};

const dueBounds = (preset: DuePreset, customFrom: string, customTo: string): { from: string | null; to: string | null } => {
  if (preset === 'custom') return { from: customFrom || null, to: customTo || null };
  if (preset === 'all' || preset === 'no_due' || preset === 'has_due' || preset === 'overdue') return { from: null, to: null };

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
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<{ userId: number; fullName: string; avatarUrl: string | null } | null>(null);

  // --- Filter states (đồng bộ với tab `List`) ---
  const [filterStatusIds, setFilterStatusIds] = useState<Task['status'][]>([]);
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

      const [rawTasks, listRows, statusRows] = await Promise.all([
        listId ? listTaskResponsesByList(listId) : listTaskResponsesByProject(projectNum),
        getListsByProject(projectNum),
        listId ? getStatusesByList(listId) : getStatusesByProject(projectNum),
      ]);

      const statusData = normalizeCollection<StatusesResponse>(statusRows);
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

      setLists([...normalizeCollection<ProjectListResponse>(listRows)].sort((a, b) => a.position - b.position));

      const userById = new Map<number, UserResponse | null | undefined>();
      userById.set(me.userId, me);

      const bundles = await Promise.all(
        (rawTasks || []).map(async (t: TaskResponse) => {
          const [tags, assignees] = await Promise.all([getTaskTags(t.taskId).catch(() => []), getTaskAssignees(t.taskId).catch(() => [])]);
          const rowBase = toDashboardTask(t, assignees, me.userId, me.fullName?.trim() || me.username || 'User', tags);

          const listStatuses = byList[t.listId] ?? [];
          const matched = listStatuses.find((s) => s.statusId === t.statusId);
          const status = matched ? mapBackendStatusGroup(String(matched.statusGroup ?? '')) : rowBase.status;

          return {
            row: { ...rowBase, status },
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

  const dueRange = useMemo(() => dueBounds(duePreset, customDueFrom, customDueTo), [duePreset, customDueFrom, customDueTo]);

  const filterActiveCount = useMemo(() => {
    return (
      filterStatusIds.length +
      filterListIds.length +
      filterTagNames.length +
      filterPriorities.length +
      filterAssigneeIds.length +
      filterReporterIds.length +
      (duePreset !== 'all' ? 1 : 0) +
      (assignedToMeOnly ? 1 : 0)
    );
  }, [assignedToMeOnly, duePreset, filterAssigneeIds.length, filterListIds.length, filterPriorities.length, filterReporterIds.length, filterStatusIds.length, filterTagNames.length]);

  const statusFilterOptions = useMemo(() => {
    const seen = new Set<Task['status']>();
    statuses.forEach((s) => {
      seen.add(mapBackendStatusGroup(String(s.statusGroup ?? '')));
    });
    tasks.forEach((t) => {
      seen.add(t.status);
    });
    return STATUS_GROUP_ORDER.filter((status) => seen.has(status)).map((status) => ({
      value: status,
      label: formatTaskStatusLabel(status),
    }));
  }, [statuses, tasks]);

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

  const filteredTasks = useMemo(() => {
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
  }, [
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
  ]);

  const clearAllFilters = () => {
    setFilterStatusIds([]);
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
    return <div className="p-8 text-gray-500">Đang tải status va task tu API...</div>;
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
      const groupKey = String(status.statusGroup || '').trim();
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
    const groupKey = String(status.statusGroup || '').trim();
    if (!statusGroupMap.has(groupKey)) statusGroupMap.set(groupKey, status.statusId);
  });

  const handleDrop = async (taskId: string, displayedStatusId: number) => {
    const displayedStatus = displayStatuses.find((s) => s.statusId === displayedStatusId);
    if (!displayedStatus) return;

    const groupKey = String(displayedStatus.statusGroup || '').trim();
    const actualStatusIdToUse = statusGroupMap.get(groupKey) ?? displayedStatusId;
    const nextStatusBucket = mapBackendStatusGroup(String(displayedStatus.statusGroup ?? ''));

    const previousTasks = [...tasks];
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === taskId ? { ...task, statusId: actualStatusIdToUse, status: nextStatusBucket } : task)),
    );

    try {
      await updateTask(Number(taskId), { statusId: actualStatusIdToUse });
    } catch (e) {
      console.error('Lỗi khi cập nhật status task:', e);
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
                            checked={filterStatusIds.includes(s.value)}
                            onCheckedChange={() =>
                              setFilterStatusIds((prev) => (prev.includes(s.value) ? prev.filter((x) => x !== s.value) : [...prev, s.value]))
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
                const columnTasks = filteredTasks.filter((task) => taskBelongsToStatus(task, status));
                const title = formatTaskStatusLabel(mapBackendStatusGroup(String(status.statusGroup ?? '')));
                const dotColor =
                  (typeof status.color === 'string' && status.color.trim().length > 0
                    ? status.color.trim()
                    : null) ?? statusGroupHeaderDotHex(String(status.statusGroup ?? ''));
                return (
                  <Column
                    key={status.statusId}
                    statusId={status.statusId}
                    title={title}
                    color={dotColor}
                    tasks={columnTasks}
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
    </div>
  );
}
