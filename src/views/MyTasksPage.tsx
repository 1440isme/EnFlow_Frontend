'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CalendarDays,
  CircleAlert,
  Clock3,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  Plus,
  X,
} from 'lucide-react';
import type { Task } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/components/ui/utils';
import { getStatusesByList } from '@/lib/status-api';
import { getCurrentUser } from '@/lib/user-api';
import {
  deleteTasksByIds,
  getTask,
  getTaskAssignees,
  getTaskTags,
  getTasksAssignedToUser,
  updateTask,
} from '@/lib/task-api';
import { ApiError } from '@/lib/http';
import type { StatusesResponse } from '@/types/api';
import type { DashboardTask } from '@/types/dashboard-task';
import {
  inferTaskStatusFromDates,
  mapBackendPriority,
  mapBackendStatusGroup,
  mapFrontendPriorityToBackend,
  toDashboardTask,
} from '@/lib/dashboard-task-mapper';
import { sortStatuses } from '@/lib/task-status-ui';
import { formatTaskPriorityLabel, TASK_PRIORITY_DISPLAY_ORDER } from '@/lib/task-priority-ui';
import { TaskTableRow, MY_TASKS_TABLE_GRID } from '@/components/tasks/TaskTableRow';
import { TaskBulkSelectionBar } from '@/components/tasks/TaskBulkSelectionBar';
import { TaskBulkDeleteDialog } from '@/components/tasks/TaskBulkDeleteDialog';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { getWorkspaceSnapshot, saveWorkspaceSnapshot, workspaceResponseToSnapshot } from '@/lib/workspace-storage';
import { getStoredUserId } from '@/lib/auth-session';
import { listWorkspacesByOwner } from '@/lib/workspace-api';

const metaColumnCell = 'min-w-0 border-l border-slate-200 pl-3';

type StatusesByList = Record<number, StatusesResponse[]>;
type GroupByOption = 'none' | 'status' | 'priority' | 'project' | 'list';
type SortByOption = 'dueDate' | 'priority' | 'updatedAt' | 'title';
type SortDirection = 'asc' | 'desc';
type MyTaskTab = 'all' | 'in-progress' | 'upcoming' | 'overdue' | 'completed';
type DateRangePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'custom';

const toDateInputValue = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toBackendDueDate = (dateValue: string) => (dateValue ? `${dateValue}T23:59:59` : null);

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

const formatYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDateRangeBounds = (
  preset: DateRangePreset,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } => {
  if (preset === 'custom') {
    return { from: customFrom || null, to: customTo || null };
  }
  if (preset === 'all') return { from: null, to: null };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'today') {
    const y = formatYmd(today);
    return { from: y, to: y };
  }
  if (preset === 'this_month') {
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

const statusLabel: Record<Task['status'], string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Done',
};

const statusGroupOrder: Task['status'][] = ['todo', 'in-progress', 'done'];

const priorityOrder: Record<Task['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  normal: 2,
  low: 3,
};

const priorityTone: Record<Task['priority'], string> = {
  low: 'text-slate-500',
  medium: 'text-blue-600',
  normal: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-rose-600',
};

export default function MyTasksPage() {
  const router = useRouter();
  const [viewerName, setViewerName] = useState('User');
  const [dashboardTasks, setDashboardTasks] = useState<DashboardTask[]>([]);
  const [taskStatusIds, setTaskStatusIds] = useState<Record<string, number>>({});
  const [statusesByList, setStatusesByList] = useState<StatusesByList>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingTaskIds, setSavingTaskIds] = useState<Record<string, boolean>>({});
  const [prioritySavingTaskIds, setPrioritySavingTaskIds] = useState<Record<string, boolean>>({});
  const [dueDateSavingTaskIds, setDueDateSavingTaskIds] = useState<Record<string, boolean>>({});
  const [dueDateDrafts, setDueDateDrafts] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<Task['status'][]>([]);
  const [filterPriorities, setFilterPriorities] = useState<Task['priority'][]>([]);
  const [filterProjectIds, setFilterProjectIds] = useState<number[]>([]);
  const [filterListIds, setFilterListIds] = useState<number[]>([]);
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [sortBy, setSortBy] = useState<SortByOption>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<MyTaskTab>('all');

  const [createOpen, setCreateOpen] = useState(false);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(() =>
    typeof window !== 'undefined' ? getWorkspaceSnapshot().workspaceId : null,
  );

  useEffect(() => {
    const sync = () => setActiveWorkspaceId(getWorkspaceSnapshot().workspaceId);
    sync();
    window.addEventListener('enflow-workspace-changed', sync);
    return () => window.removeEventListener('enflow-workspace-changed', sync);
  }, []);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const currentUser = await getCurrentUser();

      setViewerName(currentUser.fullName?.trim() || currentUser.username || 'User');

      let wsId = getWorkspaceSnapshot().workspaceId ?? activeWorkspaceId ?? undefined;
      if (!wsId) {
        const uid = getStoredUserId();
        if (uid) {
          try {
            const list = await listWorkspacesByOwner(uid);
            const personal = list.find((w) => w.workspaceKey === `personal-${uid}`) ?? list[0];
            if (personal) {
              saveWorkspaceSnapshot(workspaceResponseToSnapshot(personal));
              wsId = personal.workspaceId;
              setActiveWorkspaceId(personal.workspaceId);
            }
          } catch {
            /* no workspace resolved */
          }
        }
      }

      if (!wsId) {
        setDashboardTasks([]);
        setStatusesByList({});
        setTaskStatusIds({});
        setDueDateDrafts({});
        return;
      }

      const taskAssignments = await getTasksAssignedToUser(currentUser.userId, wsId);

      const uniqueTaskIds = Array.from(new Set(taskAssignments.map((item) => item.taskId)));
      const taskBundles = await Promise.all(
        uniqueTaskIds.map(async (taskId) => {
          const [task, tags, assignees] = await Promise.all([
            getTask(taskId),
            getTaskTags(taskId).catch(() => []),
            getTaskAssignees(taskId).catch(() => []),
          ]);

          return toDashboardTask(
            task,
            assignees,
            currentUser.userId,
            currentUser.fullName?.trim() || currentUser.username || 'User',
            tags.map((tag) => tag.tagName),
          );
        }),
      );

      const uniqueListIds = Array.from(new Set(taskBundles.map((task) => task.listId)));
      const statusesByListEntries = await Promise.all(
        uniqueListIds.map(async (listId) => [listId, await getStatusesByList(listId)] as const),
      );

      const mappedStatusesByList = Object.fromEntries(statusesByListEntries);
      const nextTaskStatusIds = Object.fromEntries(taskBundles.map((task) => [task.id, task.statusId]));

      setDashboardTasks(taskBundles);
      setStatusesByList(mappedStatusesByList);
      setTaskStatusIds(nextTaskStatusIds);
      setDueDateDrafts(Object.fromEntries(taskBundles.map((task) => [task.id, toDateInputValue(task.dueDate)])));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not load tasks from backend.';
      setErrorMessage(message);
      setDashboardTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const assignedTasks = useMemo(() => {
    return dashboardTasks.map((task) => {
      const currentStatusId = taskStatusIds[task.id] ?? task.statusId;
      const statuses = statusesByList[task.listId] ?? [];
      const matchedStatus = statuses.find((status) => status.statusId === currentStatusId);

      return {
        ...task,
        statusId: currentStatusId,
        status: matchedStatus
          ? mapBackendStatusGroup(matchedStatus.statusGroup)
          : inferTaskStatusFromDates(task.startDate, task.completedAt),
      };
    });
  }, [dashboardTasks, taskStatusIds, statusesByList]);

  const fallbackNoticeNeeded = assignedTasks.some(
    (task) => task.project.startsWith('Project #') || task.list.startsWith('List #'),
  );

  const tabCounts = useMemo(() => {
    const dueToday = assignedTasks.filter((task) => {
      if (!task.dueDate || task.status === 'done') return false;
      return toDateInputValue(task.dueDate) === toDateInputValue(new Date().toISOString());
    }).length;
    const overdue = assignedTasks.filter((task) => isOverdue(task.dueDate, task.status)).length;
    const completed = assignedTasks.filter((task) => task.status === 'done').length;
    const inProgress = assignedTasks.filter((task) => task.status === 'in-progress').length;
    const upcoming = assignedTasks.filter((task) => {
      if (!task.dueDate || task.status === 'done') return false;
      return new Date(task.dueDate).getTime() >= Date.now();
    }).length;
    return { dueToday, overdue, completed, inProgress, upcoming, all: assignedTasks.length };
  }, [assignedTasks]);

  const projectFilterOptions = useMemo(() => {
    const m = new Map<number, string>();
    assignedTasks.forEach((t) => m.set(t.projectId, t.project));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [assignedTasks]);

  const listFilterOptions = useMemo(() => {
    const m = new Map<number, { name: string; projectId: number }>();
    assignedTasks.forEach((t) => m.set(t.listId, { name: t.list, projectId: t.projectId }));
    return Array.from(m.entries())
      .map(([listId, v]) => ({ listId, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assignedTasks]);

  const filterActiveCount = useMemo(
    () =>
      filterStatuses.length +
      filterPriorities.length +
      filterProjectIds.length +
      filterListIds.length +
      (filterOverdueOnly ? 1 : 0),
    [filterStatuses, filterPriorities, filterProjectIds, filterListIds, filterOverdueOnly],
  );

  const effectiveDateRange = useMemo(
    () => getDateRangeBounds(dateRangePreset, customDateFrom, customDateTo),
    [dateRangePreset, customDateFrom, customDateTo],
  );

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const byTab = assignedTasks.filter((task) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'in-progress') return task.status === 'in-progress';
      if (activeTab === 'completed') return task.status === 'done';
      if (activeTab === 'overdue') return isOverdue(task.dueDate, task.status);
      if (!task.dueDate || task.status === 'done') return false;
      return new Date(task.dueDate).getTime() >= Date.now();
    });

    const bySearch = byTab.filter((task) => {
      if (!query) return true;
      return (
        task.title.toLowerCase().includes(query) ||
        task.project.toLowerCase().includes(query) ||
        task.list.toLowerCase().includes(query) ||
        task.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });

    const byFilters = bySearch.filter((task) => {
      if (filterStatuses.length > 0 && !filterStatuses.includes(task.status)) return false;
      if (filterPriorities.length > 0 && !filterPriorities.includes(task.priority)) return false;
      if (filterProjectIds.length > 0 && !filterProjectIds.includes(task.projectId)) return false;
      if (filterListIds.length > 0 && !filterListIds.includes(task.listId)) return false;
      if (filterOverdueOnly && !isOverdue(task.dueDate, task.status)) return false;
      return true;
    });

    const { from: rangeFrom, to: rangeTo } = effectiveDateRange;
    const byDateRange = byFilters.filter((task) => {
      if (!rangeFrom && !rangeTo) return true;
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      if (Number.isNaN(due.getTime())) return false;
      if (rangeFrom) {
        const from = new Date(`${rangeFrom}T00:00:00`);
        if (due < from) return false;
      }
      if (rangeTo) {
        const to = new Date(`${rangeTo}T23:59:59`);
        if (due > to) return false;
      }
      return true;
    });

    const sorted = [...byDateRange].sort((a, b) => {
      let compare = 0;
      if (sortBy === 'title') compare = a.title.localeCompare(b.title);
      if (sortBy === 'updatedAt') {
        const aU = new Date(a.updatedAt || a.createdAt).getTime();
        const bU = new Date(b.updatedAt || b.createdAt).getTime();
        compare = aU - bU;
      }
      if (sortBy === 'priority') compare = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (sortBy === 'dueDate') {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        compare = aDue - bDue;
      }
      return sortDirection === 'asc' ? compare : -compare;
    });

    return sorted;
  }, [
    assignedTasks,
    searchQuery,
    activeTab,
    effectiveDateRange,
    filterStatuses,
    filterPriorities,
    filterProjectIds,
    filterListIds,
    filterOverdueOnly,
    sortBy,
    sortDirection,
  ]);

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All Tasks', items: filteredTasks }];
    if (groupBy === 'status') {
      const sections = new Map<string, DashboardTask[]>();
      filteredTasks.forEach((task) => {
        const key = String(task.status);
        if (!sections.has(key)) sections.set(key, []);
        sections.get(key)?.push(task);
      });
      return Array.from(sections.entries())
        .sort(
          (a, b) => statusGroupOrder.indexOf(a[0] as Task['status']) - statusGroupOrder.indexOf(b[0] as Task['status']),
        )
        .map(([key, items]) => ({
          key,
          label: statusLabel[key as Task['status']] ?? key,
          items,
        }));
    }

    if (groupBy === 'priority') {
      const sections = new Map<string, DashboardTask[]>();
      filteredTasks.forEach((task) => {
        const key = task.priority;
        if (!sections.has(key)) sections.set(key, []);
        sections.get(key)?.push(task);
      });
      return Array.from(sections.entries())
        .sort(
          (a, b) =>
            TASK_PRIORITY_DISPLAY_ORDER.indexOf(a[0] as Task['priority']) -
            TASK_PRIORITY_DISPLAY_ORDER.indexOf(b[0] as Task['priority']),
        )
        .map(([key, items]) => ({
          key,
          label: formatTaskPriorityLabel(key as Task['priority']),
          items,
        }));
    }

    const sections = new Map<string, DashboardTask[]>();
    filteredTasks.forEach((task) => {
      const key = groupBy === 'project' ? task.project : task.list;
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)?.push(task);
    });
    return Array.from(sections.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => ({ key, label: key, items }));
  }, [filteredTasks, groupBy]);

  const selectedIdsSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);

  useEffect(() => {
    const allowed = new Set(filteredTasks.map((t) => t.id));
    setSelectedTaskIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [filteredTasks]);

  const allFilteredSelected =
    filteredTasks.length > 0 && filteredTasks.every((t) => selectedIdsSet.has(t.id));
  const someFilteredSelected =
    filteredTasks.some((t) => selectedIdsSet.has(t.id)) && !allFilteredSelected;

  const handleToggleSelectAllFiltered = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
    }
  }, [allFilteredSelected, filteredTasks]);

  const runBulkDelete = useCallback(async () => {
    const numericIds = selectedTaskIds.map((id) => Number(id));
    if (numericIds.length === 0) return;
    setBulkDeleting(true);
    setErrorMessage(null);
    try {
      const { succeeded, failed } = await deleteTasksByIds(numericIds);
      const succSet = new Set(succeeded);
      setDashboardTasks((prev) => prev.filter((t) => !succSet.has(t.taskId)));
      setTaskStatusIds((prev) => {
        const next = { ...prev };
        succeeded.forEach((tid) => {
          delete next[String(tid)];
        });
        return next;
      });
      setDueDateDrafts((prev) => {
        const next = { ...prev };
        succeeded.forEach((tid) => {
          delete next[String(tid)];
        });
        return next;
      });
      setSelectedTaskIds((prev) => prev.filter((id) => !succSet.has(Number(id))));
      setSelectedTaskId((prev) => (prev && succSet.has(Number(prev)) ? null : prev));
      setDeleteDialogOpen(false);
      if (failed.length > 0) {
        setErrorMessage(
          `Deleted ${succeeded.length} task(s). ${failed.length} failed: ${failed.map((f) => f.message).join('; ')}`,
        );
      }
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Could not delete tasks.');
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedTaskIds]);

  const selectedTask = useMemo(
    () => assignedTasks.find((task) => task.id === selectedTaskId) ?? null,
    [assignedTasks, selectedTaskId],
  );

  const getStatusOptions = (task: DashboardTask) => sortStatuses(statusesByList[task.listId] ?? []);

  const handleTaskStatusChange = async (task: DashboardTask, nextStatusId: number) => {
    const nextStatus = getStatusOptions(task).find((status) => status.statusId === nextStatusId);
    if (!nextStatus) return;

    const previousStatusId = taskStatusIds[task.id] ?? task.statusId;
    if (nextStatusId === previousStatusId) return;
    const nextStatusGroup = mapBackendStatusGroup(nextStatus.statusGroup);
    const now = new Date().toISOString().slice(0, 19);
    const nextStartDate = nextStatusGroup === 'todo' ? '' : task.startDate || now;
    const nextCompletedAt = nextStatusGroup === 'done' ? now : '';

    setTaskStatusIds((current) => ({ ...current, [task.id]: nextStatus.statusId }));
    setSavingTaskIds((current) => ({ ...current, [task.id]: true }));
    setErrorMessage(null);

    try {
      const updatedTask = await updateTask(task.taskId, {
        listId: task.listId,
        statusId: nextStatus.statusId,
        title: task.title,
        description: task.description || null,
        taskType: task.taskType,
        priority: mapFrontendPriorityToBackend(task.priority),
        reporterId: task.reporterId,
        dueDate: task.dueDate || null,
        archived: false,
        startDate: nextStartDate || null,
        completedAt: nextCompletedAt || null,
      });

      setDashboardTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                statusId: updatedTask.statusId,
                startDate: updatedTask.startDate ?? '',
                completedAt: updatedTask.completedAt ?? '',
                status: mapBackendStatusGroup(nextStatus.statusGroup),
                taskType: updatedTask.taskType,
                timeEstimateDays: updatedTask.timeEstimateDays,
                updatedAt: updatedTask.updatedAt,
              }
            : item,
        ),
      );
      setTaskStatusIds((current) => ({ ...current, [task.id]: updatedTask.statusId }));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not update task status.';
      setTaskStatusIds((current) => ({ ...current, [task.id]: previousStatusId }));
      setErrorMessage(message);
    } finally {
      setSavingTaskIds((current) => ({ ...current, [task.id]: false }));
    }
  };

  const handleTaskPriorityChange = async (task: DashboardTask, nextPriority: Task['priority']) => {
    if (task.priority === nextPriority) return;
    const previousPriority = task.priority;

    setDashboardTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, priority: nextPriority } : item)),
    );
    setPrioritySavingTaskIds((current) => ({ ...current, [task.id]: true }));
    setErrorMessage(null);

    try {
      const currentStatusId = taskStatusIds[task.id] ?? task.statusId;
      const updatedTask = await updateTask(task.taskId, {
        listId: task.listId,
        statusId: currentStatusId,
        title: task.title,
        description: task.description || null,
        taskType: task.taskType,
        priority: mapFrontendPriorityToBackend(nextPriority),
        reporterId: task.reporterId,
        dueDate: task.dueDate || null,
        archived: false,
        startDate: task.startDate || null,
        completedAt: task.completedAt || null,
      });

      setDashboardTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                priority: mapBackendPriority(updatedTask.priority),
                taskType: updatedTask.taskType,
                timeEstimateDays: updatedTask.timeEstimateDays,
                updatedAt: updatedTask.updatedAt,
              }
            : item,
        ),
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not update task priority.';
      setDashboardTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, priority: previousPriority } : item)),
      );
      setErrorMessage(message);
    } finally {
      setPrioritySavingTaskIds((current) => ({ ...current, [task.id]: false }));
    }
  };

  const handleTaskDueDateChange = async (task: DashboardTask, dateInput: string) => {
    const previousDueDate = task.dueDate;
    const nextDueDate = toBackendDueDate(dateInput);

    setDashboardTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, dueDate: nextDueDate ?? '' } : item)),
    );
    setDueDateSavingTaskIds((current) => ({ ...current, [task.id]: true }));
    setErrorMessage(null);

    try {
      const currentStatusId = taskStatusIds[task.id] ?? task.statusId;
      const updatedTask = await updateTask(task.taskId, {
        listId: task.listId,
        statusId: currentStatusId,
        title: task.title,
        description: task.description || null,
        taskType: task.taskType,
        priority: mapFrontendPriorityToBackend(task.priority),
        reporterId: task.reporterId,
        dueDate: nextDueDate,
        archived: false,
        startDate: task.startDate || null,
        completedAt: task.completedAt || null,
      });

      setDashboardTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                dueDate: updatedTask.dueDate ?? '',
                taskType: updatedTask.taskType,
                timeEstimateDays: updatedTask.timeEstimateDays,
                updatedAt: updatedTask.updatedAt,
              }
            : item,
        ),
      );
      setDueDateDrafts((current) => ({ ...current, [task.id]: toDateInputValue(updatedTask.dueDate ?? '') }));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not update due date.';
      setDashboardTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, dueDate: previousDueDate } : item)),
      );
      setDueDateDrafts((current) => ({ ...current, [task.id]: toDateInputValue(previousDueDate) }));
      setErrorMessage(message);
    } finally {
      setDueDateSavingTaskIds((current) => ({ ...current, [task.id]: false }));
    }
  };

  const sortControlLabel = useMemo(() => {
    const m: Record<string, string> = {
      'dueDate:asc': 'Due (nearest)',
      'dueDate:desc': 'Due (latest)',
      'priority:asc': 'Priority (urgent first)',
      'priority:desc': 'Priority (low first)',
      'updatedAt:desc': 'Recently updated',
      'updatedAt:asc': 'Least recently updated',
      'title:asc': 'A–Z',
      'title:desc': 'Z–A',
    };
    return m[`${sortBy}:${sortDirection}`] ?? 'Sort';
  }, [sortBy, sortDirection]);

  const sortIsNonDefault = sortBy !== 'dueDate' || sortDirection !== 'asc';

  const dateRangeIsActive = dateRangePreset !== 'all';

  const dateRangeButtonLabel = useMemo(() => {
    if (dateRangePreset === 'all') return 'Date range';
    if (dateRangePreset === 'today') return 'Today';
    if (dateRangePreset === 'this_week') return 'This week';
    if (dateRangePreset === 'this_month') return 'This month';
    return 'Custom';
  }, [dateRangePreset]);

  const toggleInNumberList = (list: number[], id: number, setter: (next: number[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  return (
    <div className="min-h-full bg-white">
      <div className="flex">
        <div className={cn('min-w-0 flex-1', selectedTask ? 'xl:pr-[360px]' : '')}>
          <div className="px-5 py-5">
            <h1 className="text-3xl font-semibold text-slate-900">My Tasks</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-slate-500">{tabCounts.dueToday} due today</span>
              <span className="text-slate-300">·</span>
              <span className="text-rose-500">{tabCounts.overdue} overdue</span>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-600">{tabCounts.completed} completed</span>
            </div>

            <div className="mt-4 flex w-full min-w-0 flex-wrap items-center gap-2">
              <div className="relative w-full max-w-[min(50%,22rem)] min-w-[200px] shrink-0">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tasks..."
                  className="h-9 w-full border-slate-200 bg-slate-50 pl-9 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-9 gap-1.5 border-slate-200 px-3 text-xs font-medium text-slate-700',
                        filterActiveCount > 0 && 'border-[#0057b8]/40 bg-blue-50/50',
                      )}
                    >
                      <SlidersHorizontal className="size-3.5 text-slate-500" />
                      Filter
                      {filterActiveCount > 0 ? (
                        <Badge className="h-5 min-w-5 rounded-full bg-[#0057b8] px-1.5 text-[10px] text-white">
                          {filterActiveCount}
                        </Badge>
                      ) : null}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-h-[min(70vh,28rem)] w-80 overflow-y-auto p-3" align="start">
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                        <div className="flex flex-col gap-2">
                          {statusGroupOrder.map((s) => (
                            <label key={s} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                              <Checkbox
                                checked={filterStatuses.includes(s)}
                                onCheckedChange={() =>
                                  setFilterStatuses((prev) =>
                                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                                  )
                                }
                              />
                              {statusLabel[s]}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</p>
                        <div className="flex flex-col gap-2">
                          {TASK_PRIORITY_DISPLAY_ORDER.map((p) => (
                            <label key={p} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                              <Checkbox
                                checked={filterPriorities.includes(p)}
                                onCheckedChange={() =>
                                  setFilterPriorities((prev) =>
                                    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                                  )
                                }
                              />
                              <span>{formatTaskPriorityLabel(p)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
                        <div className="flex max-h-28 flex-col gap-2 overflow-y-auto pr-1">
                          {projectFilterOptions.length === 0 ? (
                            <p className="text-xs text-slate-500">No projects in your tasks yet.</p>
                          ) : (
                            projectFilterOptions.map(([projectId, name]) => (
                              <label
                                key={projectId}
                                className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"
                              >
                                <Checkbox
                                  checked={filterProjectIds.includes(projectId)}
                                  onCheckedChange={() =>
                                    toggleInNumberList(filterProjectIds, projectId, setFilterProjectIds)
                                  }
                                />
                                <span className="truncate">{name}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">List</p>
                        <div className="flex max-h-28 flex-col gap-2 overflow-y-auto pr-1">
                          {listFilterOptions.length === 0 ? (
                            <p className="text-xs text-slate-500">No lists in your tasks yet.</p>
                          ) : (
                            listFilterOptions.map((row) => (
                              <label
                                key={row.listId}
                                className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"
                              >
                                <Checkbox
                                  checked={filterListIds.includes(row.listId)}
                                  onCheckedChange={() =>
                                    toggleInNumberList(filterListIds, row.listId, setFilterListIds)
                                  }
                                />
                                <span className="truncate">{row.name}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                        <Checkbox
                          checked={filterOverdueOnly}
                          onCheckedChange={(v) => setFilterOverdueOnly(Boolean(v))}
                        />
                        Overdue only
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-full text-xs text-slate-600"
                        onClick={() => {
                          setFilterStatuses([]);
                          setFilterPriorities([]);
                          setFilterProjectIds([]);
                          setFilterListIds([]);
                          setFilterOverdueOnly(false);
                        }}
                      >
                        Clear all filters
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-9 max-w-[14rem] gap-1.5 border-slate-200 px-3 text-xs font-medium text-slate-700',
                        sortIsNonDefault && 'border-[#0057b8]/40 bg-blue-50/50',
                      )}
                    >
                      <ArrowUpDown className="size-3.5 shrink-0 text-slate-500" />
                      <span className="truncate">{sortIsNonDefault ? sortControlLabel : 'Sort'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Sort by</label>
                    <select
                      value={`${sortBy}:${sortDirection}`}
                      onChange={(event) => {
                        const [nextSortBy, nextSortDirection] = event.target.value.split(':') as [
                          SortByOption,
                          SortDirection,
                        ];
                        setSortBy(nextSortBy);
                        setSortDirection(nextSortDirection);
                      }}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800"
                    >
                      <option value="dueDate:asc">Due date (nearest)</option>
                      <option value="dueDate:desc">Due date (latest)</option>
                      <option value="priority:asc">Priority (urgent first)</option>
                      <option value="priority:desc">Priority (low first)</option>
                      <option value="updatedAt:desc">Recently updated</option>
                      <option value="updatedAt:asc">Least recently updated</option>
                      <option value="title:asc">Title (A–Z)</option>
                      <option value="title:desc">Title (Z–A)</option>
                    </select>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-9 max-w-[12rem] gap-1.5 border-slate-200 px-3 text-xs font-medium text-slate-700',
                        groupBy !== 'none' && 'border-[#0057b8]/40 bg-blue-50/50',
                      )}
                    >
                      <LayoutGrid className="size-3.5 shrink-0 text-slate-500" />
                      <span className="truncate">
                        {groupBy === 'none' ? 'Group by' : `Group: ${groupBy}`}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="start">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Group by</label>
                    <select
                      value={groupBy}
                      onChange={(event) => setGroupBy(event.target.value as GroupByOption)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800"
                    >
                      <option value="none">None</option>
                      <option value="status">Status</option>
                      <option value="priority">Priority</option>
                      <option value="project">Project</option>
                      <option value="list">List</option>
                    </select>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-9 max-w-[12rem] gap-1.5 border-slate-200 px-3 text-xs font-medium text-slate-700',
                        dateRangeIsActive && 'border-[#0057b8]/40 bg-blue-50/50',
                      )}
                    >
                      <CalendarDays className="size-3.5 shrink-0 text-slate-500" />
                      <span className="truncate">{dateRangeButtonLabel}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preset</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ['all', 'All'],
                            ['today', 'Today'],
                            ['this_week', 'This week'],
                            ['this_month', 'This month'],
                            ['custom', 'Custom'],
                          ] as const
                        ).map(([preset, label]) => (
                          <Button
                            key={preset}
                            type="button"
                            size="sm"
                            variant={dateRangePreset === preset ? 'default' : 'outline'}
                            className={cn(
                              'h-8 text-xs',
                              dateRangePreset === preset ? 'bg-[#0057b8] hover:bg-[#00489a]' : 'border-slate-200',
                            )}
                            onClick={() => setDateRangePreset(preset as DateRangePreset)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      {dateRangePreset === 'custom' ? (
                        <div className="space-y-2 border-t border-slate-100 pt-3">
                          <div>
                            <Label className="text-xs text-slate-500">From</Label>
                            <Input
                              type="date"
                              value={customDateFrom}
                              onChange={(event) => setCustomDateFrom(event.target.value)}
                              className="mt-1 h-9 border-slate-200 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">To</Label>
                            <Input
                              type="date"
                              value={customDateTo}
                              onChange={(event) => setCustomDateTo(event.target.value)}
                              className="mt-1 h-9 border-slate-200 text-sm"
                            />
                          </div>
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-full text-xs text-slate-600"
                        onClick={() => {
                          setDateRangePreset('all');
                          setCustomDateFrom('');
                          setCustomDateTo('');
                        }}
                      >
                        Clear date range
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                type="button"
                className="ml-auto h-9 shrink-0 rounded-md bg-[#0057b8] px-3 text-xs font-semibold hover:bg-[#00489a]"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-1 size-3.5" />
                Create Task
              </Button>
            </div>

            <div className="mt-4 border-b border-slate-200">
              <div className="flex gap-5 text-sm">
                {[
                  { key: 'all', label: 'All', count: tabCounts.all },
                  { key: 'in-progress', label: 'In Progress', count: tabCounts.inProgress },
                  { key: 'upcoming', label: 'Upcoming', count: tabCounts.upcoming },
                  { key: 'overdue', label: 'Overdue', count: tabCounts.overdue },
                  { key: 'completed', label: 'Completed', count: tabCounts.completed },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as MyTaskTab)}
                    className={cn(
                      'border-b-2 px-0.5 py-2 text-sm',
                      activeTab === tab.key ? 'border-[#0057b8] font-semibold text-[#0057b8]' : 'border-transparent text-slate-600',
                    )}
                  >
                    {tab.label}
                    <span className="ml-1 text-xs text-slate-500">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {fallbackNoticeNeeded ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Missing `projectName/listName` in some task payloads. UI is temporarily mapping by IDs/taskCode.
              </p>
            ) : null}

            {errorMessage ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {filteredTasks.length > 0 && selectedTaskIds.length > 0 ? (
              <div className="mt-4">
                <TaskBulkSelectionBar
                  count={selectedTaskIds.length}
                  onDelete={() => setDeleteDialogOpen(true)}
                  onClear={() => setSelectedTaskIds([])}
                  deleting={bulkDeleting}
                />
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
              <ScrollArea className="h-[calc(100vh-290px)] min-h-[420px]">
                <div className="min-w-[960px]">
                  {/* Checkbox | Task | Project | List | Status | Priority | Due Date */}
                  <div
                    className={cn(
                      MY_TASKS_TABLE_GRID,
                      'items-center border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500',
                    )}
                  >
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={someFilteredSelected ? 'indeterminate' : allFilteredSelected}
                        onCheckedChange={handleToggleSelectAllFiltered}
                        disabled={filteredTasks.length === 0}
                        aria-label="Select all tasks in current view"
                        className="border-slate-300"
                      />
                    </div>
                    <div className="min-w-0">Task</div>
                    <div className="min-w-0">Project</div>
                    <div className="min-w-0">List</div>
                    <div className={cn(metaColumnCell, 'whitespace-nowrap text-left')}>Status</div>
                    <div className={cn(metaColumnCell, 'whitespace-nowrap text-left')}>Priority</div>
                    <div className={cn(metaColumnCell, 'whitespace-nowrap text-left')}>Due Date</div>
                  </div>

                  {isLoading ? (
                    <div className="px-4 py-8 text-sm text-slate-500">Loading tasks...</div>
                  ) : null}

                  {!isLoading && filteredTasks.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">
                      No tasks match your current filters.
                    </div>
                  ) : null}

                  {!isLoading &&
                    groupedTasks.map((group) => (
                      <div key={group.key}>
                        {groupBy !== 'none' ? (
                          <div className="bg-slate-50/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                            {group.label} ({group.items.length})
                          </div>
                        ) : null}

                        {group.items.map((task) => {
                          const statuses = getStatusOptions(task);
                          const currentStatusId = taskStatusIds[task.id] ?? task.statusId;
                          const rowSelected = selectedTaskId === task.id;

                          return (
                            <TaskTableRow
                              key={task.id}
                              task={task}
                              statuses={statuses}
                              currentStatusId={currentStatusId}
                              selection={{
                                checked: selectedIdsSet.has(task.id),
                                onCheckedChange: (checked) => {
                                  setSelectedTaskIds((prev) =>
                                    checked
                                      ? prev.includes(task.id)
                                        ? prev
                                        : [...prev, task.id]
                                      : prev.filter((x) => x !== task.id),
                                  );
                                },
                              }}
                              rowSelected={rowSelected}
                              onRowDoubleClick={() =>
                                setSelectedTaskId((prev) => (prev === task.id ? null : task.id))
                              }
                              onStatusChange={handleTaskStatusChange}
                              onPriorityChange={handleTaskPriorityChange}
                              dueDateDraft={dueDateDrafts[task.id] ?? ''}
                              onDueDateDraftChange={(value) =>
                                setDueDateDrafts((current) => ({ ...current, [task.id]: value }))
                              }
                              onDueDateBlur={(value) => {
                                if (value === toDateInputValue(task.dueDate)) return;
                                void handleTaskDueDateChange(task, value);
                              }}
                              statusSaving={Boolean(savingTaskIds[task.id])}
                              prioritySaving={Boolean(prioritySavingTaskIds[task.id])}
                              dueDateSaving={Boolean(dueDateSavingTaskIds[task.id])}
                            />
                          );
                        })}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {selectedTask ? (
          <aside className="fixed top-16 right-0 bottom-0 z-30 hidden w-[350px] flex-col border-l border-slate-200 bg-white shadow-sm xl:flex">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <span className="truncate text-sm font-semibold text-slate-900">Quick edit</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-slate-500 hover:text-slate-900"
                aria-label="Close panel"
                onClick={() => setSelectedTaskId(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{selectedTask.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedTask.description || 'No description'}</p>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Location</p>
                  <div className="text-sm text-slate-800">{selectedTask.project}</div>
                  <div className="text-sm text-slate-600">{selectedTask.list}</div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</p>
                  <p className="text-sm text-slate-800">{selectedTask.status}</p>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Priority</p>
                  <p className={cn('text-sm', priorityTone[selectedTask.priority])}>
                    {formatTaskPriorityLabel(selectedTask.priority)}
                  </p>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Due Date</p>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <Calendar className="size-4 shrink-0 text-slate-400" />
                    <span className="font-medium">{formatDateShort(selectedTask.dueDate)}</span>
                  </div>
                  {selectedTask.timeEstimateDays != null && selectedTask.timeEstimateDays > 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="size-3.5 text-slate-400" />
                      <span>{selectedTask.timeEstimateDays}d estimated</span>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Assignee</p>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <div className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {selectedTask.assignee.charAt(0).toUpperCase()}
                    </div>
                    {selectedTask.assignee}
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Labels</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTask.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="rounded-md border-slate-200 bg-slate-100 text-[10px] text-slate-600">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* RECENT_ACTIVITY_PANEL: re-enable when task activity / comments API is wired (avoid mock “recent activity”)
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Recent Activity</p>
                  ...
                </div>
                */}

                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500">
                    <CircleAlert className="size-3.5" />
                    Changes auto-save instantly
                  </div>
                  <Button className="w-full" onClick={() => router.push(`/app/tasks/${selectedTask.id}`)}>
                    View Full Details
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </aside>
        ) : null}
      </div>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void loadTasks()} />

      <TaskBulkDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        count={selectedTaskIds.length}
        onConfirm={runBulkDelete}
        deleting={bulkDeleting}
      />
    </div>
  );
}
