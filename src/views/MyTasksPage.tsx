'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Folder,
  List,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  Flag,
  Clock3,
  Plus,
  X,
} from 'lucide-react';
import type { Task } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/components/ui/utils';
import { getProjectsByWorkspace, type ProjectResponse } from '@/lib/project-api';
import { getListsByProject } from '@/lib/list-api';
import { getStatusesByList } from '@/lib/status-api';
import { getCurrentUser } from '@/lib/user-api';
import { getStoredUserId } from '@/lib/auth-session';
import { listWorkspaces, listWorkspacesByOwner } from '@/lib/workspace-api';
import {
  addTaskAssignee,
  createTask,
  getTask,
  getTaskAssignees,
  getTaskTags,
  getTasksAssignedToUser,
  updateTask,
  type TaskAssigneeResponse,
  type TaskResponse,
} from '@/lib/task-api';
import { ApiError } from '@/lib/http';
import type { StatusesResponse } from '@/types/api';

type DashboardTask = Task & {
  taskId: number;
  projectId: number;
  listId: number;
  statusId: number;
  reporterId: number;
  startDate: string;
  completedAt: string;
  list: string;
  taskType: TaskResponse['taskType'];
  timeEstimateDays: number | null;
  updatedAt: string;
};

type StatusesByList = Record<number, StatusesResponse[]>;
type GroupByOption = 'none' | 'status' | 'priority' | 'project' | 'list';
type SortByOption = 'dueDate' | 'priority' | 'updatedAt' | 'title';
type SortDirection = 'asc' | 'desc';
type MyTaskTab = 'all' | 'in-progress' | 'upcoming' | 'overdue' | 'completed';
type DateRangePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'custom';

const fallbackAvatar = '/placeholder.svg';

const mapBackendPriority = (priority: TaskResponse['priority']): Task['priority'] => {
  if (priority === 'normal') return 'medium';
  return priority;
};

const mapFrontendPriorityToBackend = (priority: Task['priority']): TaskResponse['priority'] =>
  priority === 'medium' ? 'normal' : priority;

/** Chuẩn hoá statusGroup từ API (enum snake_case hoặc display name kiểu "IN PROGRESS"). */
function normalizeBackendStatusGroupKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

const mapBackendStatusGroup = (statusGroup: string): Task['status'] => {
  const g = normalizeBackendStatusGroupKey(statusGroup);
  if (g === 'completed') return 'done';
  if (['in_progress', 'review', 'testing', 'deploy'].includes(g)) return 'in-progress';
  return 'todo';
};

const inferTaskStatusFromDates = (
  startDate: string | null | undefined,
  completedAt: string | null | undefined,
): Task['status'] => {
  if (completedAt) return 'done';
  if (startDate && new Date(startDate).getTime() <= Date.now()) return 'in-progress';
  return 'todo';
};

/** Backend StatusesRespone không có `name`; hiển thị từ statusGroup (API thật). */
const formatStatusLabel = (s: StatusesResponse) => {
  const rawName = (s as { name?: string | null }).name;
  if (typeof rawName === 'string' && rawName.trim()) return rawName.trim();
  const g = String(s.statusGroup ?? '').replace(/_/g, ' ');
  return g.trim() || `Status #${s.statusId}`;
};

const sortStatuses = (statuses: StatusesResponse[]) =>
  [...statuses].sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER);
  });

const pickPrimaryAssignee = (
  assignees: TaskAssigneeResponse[],
  currentUserId: number,
) => assignees.find((item) => item.isPrimary) ?? assignees.find((item) => item.userId === currentUserId) ?? assignees[0];

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
const priorityGroupOrder: Task['priority'][] = ['urgent', 'high', 'medium', 'normal', 'low'];

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

const statusBadgeTone = (statusGroup: string) => {
  const g = normalizeBackendStatusGroupKey(statusGroup);
  if (g === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (g === 'review') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (g === 'in_progress' || g === 'testing' || g === 'deploy') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (g === 'backlog' || g === 'idea') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

/** Dot + label colors for open status menu rows (Figma-style) */
const statusMenuItemStyles = (statusGroup: string): { dot: string; label: string } => {
  const g = normalizeBackendStatusGroupKey(statusGroup);
  switch (g) {
    case 'completed':
      return { dot: 'bg-emerald-500', label: 'text-emerald-700' };
    case 'review':
      return { dot: 'bg-violet-500', label: 'text-violet-700' };
    case 'in_progress':
      return { dot: 'bg-blue-500', label: 'text-blue-700' };
    case 'testing':
    case 'deploy':
      return { dot: 'bg-amber-500', label: 'text-amber-700' };
    case 'idea':
    case 'backlog':
    case 'to_do':
    default:
      return { dot: 'bg-slate-400', label: 'text-slate-600' };
  }
};

const priorityMenuItemStyles: Record<Task['priority'], { label: string; flag: string }> = {
  low: { label: 'text-slate-600', flag: 'text-slate-500' },
  medium: { label: 'text-blue-600', flag: 'text-blue-600' },
  normal: { label: 'text-blue-600', flag: 'text-blue-600' },
  high: { label: 'text-orange-600', flag: 'text-orange-600' },
  urgent: { label: 'text-rose-600', flag: 'text-rose-600' },
};

/** Separate lanes for Status | Priority | Due Date (fixed widths + gap; controls stay compact inside cells). */
const MY_TASKS_TABLE_GRID =
  'grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_11.75rem_9.75rem_13.5rem] gap-x-4';

const metaColumnCell = 'min-w-0 border-l border-slate-200 pl-3';

const toDashboardTask = (
  task: TaskResponse,
  assignees: TaskAssigneeResponse[],
  currentUserId: number,
  currentUserName: string,
  tagNames: string[],
): DashboardTask => {
  const primaryAssignee = pickPrimaryAssignee(assignees, currentUserId);
  const assigneeName = primaryAssignee?.fullName?.trim() || currentUserName || 'User';

  return {
    id: String(task.taskId),
    taskId: task.taskId,
    title: task.title,
    description: task.description ?? '',
    status: inferTaskStatusFromDates(task.startDate, task.completedAt),
    priority: mapBackendPriority(task.priority),
    projectId: task.projectId,
    listId: task.listId,
    statusId: task.statusId,
    reporterId: task.reporterId,
    startDate: task.startDate ?? '',
    completedAt: task.completedAt ?? '',
    assignee: assigneeName,
    assigneeAvatar: fallbackAvatar,
    project: task.projectName?.trim() || task.taskCode?.trim() || `Project #${task.projectId}`,
    list: task.listName?.trim() || `List #${task.listId}`,
    dueDate: task.dueDate ?? '',
    createdAt: task.createdAt,
    tags: tagNames,
    taskType: task.taskType,
    timeEstimateDays: task.timeEstimateDays,
    updatedAt: task.updatedAt,
  };
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
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createProjectId, setCreateProjectId] = useState<number | ''>('');
  const [createListId, setCreateListId] = useState<number | ''>('');
  const [createStatusId, setCreateStatusId] = useState<number | ''>('');
  const [createPriority, setCreatePriority] = useState<Task['priority']>('medium');
  const [createDue, setCreateDue] = useState('');
  const [createLists, setCreateLists] = useState<{ listProjectId: number; name: string }[]>([]);
  const [createProjectsCatalog, setCreateProjectsCatalog] = useState<ProjectResponse[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createListsLoading, setCreateListsLoading] = useState(false);
  const [createStatusesLoading, setCreateStatusesLoading] = useState(false);
  const [createCatalogLoading, setCreateCatalogLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  /** Status cho form Create (chỉ từ API theo list đã chọn), tách khỏi map status của bảng task. */
  const [createFormStatuses, setCreateFormStatuses] = useState<StatusesResponse[]>([]);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const currentUser = await getCurrentUser();

      setViewerName(currentUser.fullName?.trim() || currentUser.username || 'User');

      const taskAssignments = await getTasksAssignedToUser(currentUser.userId);

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
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const assignedTasks = dashboardTasks.map((task) => {
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
            priorityGroupOrder.indexOf(a[0] as Task['priority']) -
            priorityGroupOrder.indexOf(b[0] as Task['priority']),
        )
        .map(([key, items]) => ({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
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

  /** Chỉ project từ API (catalog), không merge tên từ task row. */
  const projectsForCreate = useMemo(() => {
    return [...createProjectsCatalog]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => [p.idProject, p.name] as [number, string]);
  }, [createProjectsCatalog]);

  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    setCreateError(null);
    setCreateCatalogLoading(true);
    (async () => {
      try {
        let all: ProjectResponse[] = [];

        const workspaces = await listWorkspaces().catch(() => [] as Awaited<ReturnType<typeof listWorkspaces>>);
        if (workspaces.length > 0) {
          for (const ws of workspaces) {
            const projects = await getProjectsByWorkspace(ws.workspaceId).catch(() => []);
            all.push(...projects);
          }
        }

        if (all.length === 0) {
          const userId = getStoredUserId();
          if (userId) {
            const owned = await listWorkspacesByOwner(userId).catch(() => []);
            for (const ws of owned) {
              const projects = await getProjectsByWorkspace(ws.workspaceId).catch(() => []);
              all.push(...projects);
            }
          }
        }

        const seen = new Set<number>();
        const deduped = all.filter((p) => {
          if (seen.has(p.idProject)) return false;
          seen.add(p.idProject);
          return true;
        });
        if (!cancelled) setCreateProjectsCatalog(deduped);
      } catch {
        if (!cancelled) setCreateProjectsCatalog([]);
      } finally {
        setCreateCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setCreateCatalogLoading(false);
    };
  }, [createOpen]);

  useEffect(() => {
    if (createProjectId === '' || typeof createProjectId !== 'number') {
      setCreateLists([]);
      setCreateListId('');
      setCreateStatusId('');
      setCreateFormStatuses([]);
      return;
    }
    let cancelled = false;
    setCreateListsLoading(true);
    void getListsByProject(createProjectId)
      .then((lists) => {
        if (cancelled) return;
        const mapped = lists.map((l) => ({ listProjectId: l.listProjectId, name: l.name }));
        setCreateLists(mapped);
        setCreateListId((prev) => {
          if (typeof prev === 'number' && mapped.some((m) => m.listProjectId === prev)) return prev;
          return mapped.length === 1 ? mapped[0].listProjectId : '';
        });
      })
      .finally(() => {
        if (!cancelled) setCreateListsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createProjectId]);

  useEffect(() => {
    if (createListId === '' || typeof createListId !== 'number') {
      setCreateStatusId('');
      setCreateStatusesLoading(false);
      setCreateFormStatuses([]);
      return;
    }
    let cancelled = false;
    setCreateStatusesLoading(true);
    void getStatusesByList(createListId)
      .then((st) => {
        if (cancelled) return;
        const sorted = sortStatuses(st);
        setCreateFormStatuses(sorted);
        const def =
          sorted.find((s) => normalizeBackendStatusGroupKey(s.statusGroup) === 'to_do') ??
          sorted.find((s) => s.isDefault) ??
          sorted[0];
        setCreateStatusId(def ? def.statusId : '');
      })
      .finally(() => {
        if (!cancelled) setCreateStatusesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createListId]);

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

  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setCreateError(null);
      setCreateFormStatuses([]);
    }
  };

  const handleCreateTaskSubmit = async () => {
    if (createLoading) return;
    setCreateError(null);
    if (
      !createTitle.trim() ||
      createProjectId === '' ||
      createListId === '' ||
      createStatusId === '' ||
      typeof createProjectId !== 'number' ||
      typeof createListId !== 'number' ||
      typeof createStatusId !== 'number'
    ) {
      setCreateError('Please fill title, project, list, and status.');
      return;
    }
    if (createCatalogLoading || createListsLoading || createStatusesLoading) {
      setCreateError('Please wait for lists and statuses to finish loading.');
      return;
    }
    setCreateLoading(true);
    try {
      const user = await getCurrentUser();
      const created = await createTask(createProjectId, createListId, createStatusId, {
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        taskType: 'task',
        priority: mapFrontendPriorityToBackend(createPriority),
        reporterId: user.userId,
        dueDate: createDue ? `${createDue}T23:59:59` : null,
      });
      await addTaskAssignee(created.taskId, { userId: user.userId, isPrimary: true });
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateProjectId('');
      setCreateListId('');
      setCreateStatusId('');
      setCreatePriority('medium');
      setCreateDue('');
      setCreateError(null);
      setCreateFormStatuses([]);
      await loadTasks();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not create task.';
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const createSubmitDisabled =
    createLoading ||
    createCatalogLoading ||
    createListsLoading ||
    createStatusesLoading ||
    projectsForCreate.length === 0 ||
    !createTitle.trim() ||
    createProjectId === '' ||
    createListId === '' ||
    createStatusId === '' ||
    typeof createProjectId !== 'number' ||
    typeof createListId !== 'number' ||
    typeof createStatusId !== 'number';

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
                          {priorityGroupOrder.map((p) => (
                            <label key={p} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                              <Checkbox
                                checked={filterPriorities.includes(p)}
                                onCheckedChange={() =>
                                  setFilterPriorities((prev) =>
                                    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                                  )
                                }
                              />
                              <span className="capitalize">{p}</span>
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

            <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
              <ScrollArea className="h-[calc(100vh-290px)] min-h-[420px]">
                <div className="min-w-[920px]">
                  {/* Task | Project | List | Status | Priority | Due Date — three distinct metadata columns */}
                  <div
                    className={cn(
                      MY_TASKS_TABLE_GRID,
                      'items-center border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500',
                    )}
                  >
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
                          const currentStatus = statuses.find((status) => status.statusId === currentStatusId) ?? null;
                          const rowSelected = selectedTaskId === task.id;

                          return (
                            <div
                              key={task.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedTaskId((prev) => (prev === task.id ? null : task.id))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setSelectedTaskId((prev) => (prev === task.id ? null : task.id));
                                }
                              }}
                              className={cn(
                                MY_TASKS_TABLE_GRID,
                                'cursor-pointer items-center border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50',
                                rowSelected && 'bg-blue-50 hover:bg-blue-50',
                              )}
                            >
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

                              <div
                                className={cn(metaColumnCell, 'flex items-center justify-start')}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      disabled={Boolean(savingTaskIds[task.id]) || statuses.length === 0}
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
                                          onSelect={() => void handleTaskStatusChange(task, status.statusId)}
                                        >
                                          <span className="flex min-w-0 flex-1 items-center gap-2">
                                            <span
                                              className={cn('size-2 shrink-0 rounded-full', menuStyles.dot)}
                                              aria-hidden
                                            />
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

                              <div
                                className={cn(metaColumnCell, 'flex items-center justify-start')}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      disabled={Boolean(prioritySavingTaskIds[task.id])}
                                      className={cn(
                                        'inline-flex h-7 w-fit max-w-full items-center gap-1 rounded-md border border-transparent px-0.5 py-0.5 text-xs font-semibold capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60',
                                        priorityTone[task.priority],
                                      )}
                                    >
                                      <Flag className="size-3 shrink-0 opacity-90" />
                                      <span className="min-w-0 max-w-[6.5rem] truncate whitespace-nowrap">
                                        {task.priority}
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
                                      const selected = task.priority === priorityOption;
                                      return (
                                        <DropdownMenuItem
                                          key={priorityOption}
                                          className="cursor-pointer gap-2 rounded-md px-2 py-1.5 focus:bg-slate-50"
                                          onSelect={() => void handleTaskPriorityChange(task, priorityOption)}
                                        >
                                          <span className="flex min-w-0 flex-1 items-center gap-2">
                                            <Flag className={cn('size-4 shrink-0', pm.flag)} strokeWidth={2} />
                                            <span className={cn('truncate text-sm font-medium capitalize', pm.label)}>
                                              {priorityOption}
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

                              <div
                                className={cn(metaColumnCell, 'flex items-center justify-start')}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="inline-flex w-full max-w-full min-w-0 flex-col gap-1">
                                  <div
                                    className={cn(
                                      'flex items-center gap-1.5 text-xs font-semibold leading-none',
                                      isOverdue(task.dueDate, task.status) ? 'text-rose-600' : 'text-slate-800',
                                    )}
                                  >
                                    <Calendar className="size-3.5 shrink-0 opacity-70" />
                                    <span className="whitespace-nowrap">
                                      {task.dueDate ? formatDateShort(task.dueDate) : '—'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <Input
                                      type="date"
                                      value={dueDateDrafts[task.id] ?? ''}
                                      disabled={Boolean(dueDateSavingTaskIds[task.id])}
                                      onChange={(event) =>
                                        setDueDateDrafts((current) => ({ ...current, [task.id]: event.target.value }))
                                      }
                                      onBlur={(event) => {
                                        if ((dueDateDrafts[task.id] ?? '') === toDateInputValue(task.dueDate)) return;
                                        void handleTaskDueDateChange(task, event.target.value);
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

                              {/* ACTIVITY_COLUMN: restore when subtasks/comments/attachments counts are available from API
                              <div className="flex items-center gap-2 text-xs text-slate-500">...</div>
                              */}
                            </div>
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
                  <p className={cn('text-sm capitalize', priorityTone[selectedTask.priority])}>{selectedTask.priority}</p>
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

      <Dialog open={createOpen} onOpenChange={handleCreateDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-visible sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>Add a task and assign it to yourself so it appears in My Tasks.</DialogDescription>
          </DialogHeader>
          {createError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {createError}
            </div>
          ) : null}
          <div className="grid max-h-[min(70vh,28rem)] gap-3 overflow-y-auto py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="create-title">Title</Label>
              <Input
                id="create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Task title"
                className="border-slate-200"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-project">Project</Label>
              <Select
                value={createProjectId === '' ? undefined : String(createProjectId)}
                onValueChange={(v) => setCreateProjectId(v ? Number(v) : '')}
                disabled={createCatalogLoading || projectsForCreate.length === 0}
              >
                <SelectTrigger id="create-project" className="w-full border-slate-200 bg-white">
                  <SelectValue
                    placeholder={createCatalogLoading ? 'Loading projects…' : 'Select project'}
                  />
                </SelectTrigger>
                <SelectContent className="z-[110] max-h-[min(280px,70vh)]">
                  {projectsForCreate.map(([pid, name]) => (
                    <SelectItem key={pid} value={String(pid)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createCatalogLoading ? (
                <p className="text-xs text-slate-500">Loading projects from API…</p>
              ) : projectsForCreate.length === 0 ? (
                <p className="text-xs text-amber-800">
                  No projects returned from API. Create a project first or check your workspaces.
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-list">List</Label>
              <Select
                value={createListId === '' ? undefined : String(createListId)}
                onValueChange={(v) => setCreateListId(v ? Number(v) : '')}
                disabled={createProjectId === '' || createListsLoading}
              >
                <SelectTrigger id="create-list" className="w-full border-slate-200 bg-white">
                  <SelectValue placeholder={createListsLoading ? 'Loading…' : 'Select list'} />
                </SelectTrigger>
                <SelectContent className="z-[110] max-h-[min(280px,70vh)]">
                  {createLists.map((l) => (
                    <SelectItem key={l.listProjectId} value={String(l.listProjectId)}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-status">Status</Label>
              <Select
                value={createStatusId === '' ? undefined : String(createStatusId)}
                onValueChange={(v) => setCreateStatusId(v ? Number(v) : '')}
                disabled={createListId === '' || createStatusesLoading}
              >
                <SelectTrigger id="create-status" className="w-full border-slate-200 bg-white">
                  <SelectValue placeholder={createStatusesLoading ? 'Loading…' : 'Select status'} />
                </SelectTrigger>
                <SelectContent className="z-[110] max-h-[min(280px,70vh)]">
                  {createFormStatuses.map((s) => (
                    <SelectItem key={s.statusId} value={String(s.statusId)}>
                      {formatStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-priority">Priority</Label>
              <Select
                value={createPriority}
                onValueChange={(v) => setCreatePriority(v as Task['priority'])}
              >
                <SelectTrigger id="create-priority" className="w-full border-slate-200 bg-white capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium (normal)</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-due">Due date</Label>
              <Input
                id="create-due"
                type="date"
                value={createDue}
                onChange={(e) => setCreateDue(e.target.value)}
                className="border-slate-200"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-desc">Description (optional)</Label>
              <Textarea
                id="create-desc"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Details…"
                rows={3}
                className="resize-none border-slate-200"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCreateDialogOpenChange(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#0057b8] hover:bg-[#00489a]"
              disabled={createSubmitDisabled}
              onClick={() => void handleCreateTaskSubmit()}
            >
              {createLoading ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
