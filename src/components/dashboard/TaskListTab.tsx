'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Task } from '@/types/task';
import type { DashboardTask } from '@/types/dashboard-task';
import {
  addTaskAssignee,
  deleteTasksByIds,
  getTaskAssignees,
  getTaskTags,
  listTaskResponsesByList,
  listTaskResponsesByProject,
  removeTaskAssignee,
  updateTask,
  type TaskTagResponse,
} from '@/lib/task-api';
import { countDirectSubtasksByParentId } from '@/lib/task-subtask-utils';
import { assigneeUserIdsFromRows, taskAssigneeRowsToDisplay } from '@/lib/task-assignee-utils';
import { getProjectById, getProjectListsStatuses } from '@/lib/project-api';
import { listWorkspaceMembers } from '@/lib/workspace-api';
import { getCurrentUser, getUserById } from '@/lib/user-api';
import { ApiError } from '@/lib/http';
import type {
  ProjectListResponse,
  ProjectListWithStatusesResponse,
  StatusesResponse,
  UserResponse,
  WorkspaceMemberResponse,
} from '@/types/api';
import CreateListDialog from './CreateListDialog';
import RenameListDialog from './RenameListDialog';
import DeleteListDialog from './DeleteListDialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ChevronDown, ChevronRight, Filter, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import {
  mapBackendPriority,
  mapFrontendPriorityToBackend,
  pickPrimaryAssignee,
  toDashboardTask,
} from '@/lib/dashboard-task-mapper';
import { formatStatusLabel, sectionStatusDotPresentation, sortStatuses, statusVisualBucketFromGroup } from '@/lib/task-status-ui';
import { formatTaskPriorityLabel, TASK_PRIORITY_DISPLAY_ORDER } from '@/lib/task-priority-ui';
import { TaskTableRow, TASK_TABLE_GRID_WITH_ASSIGNEE } from '@/components/tasks/TaskTableRow';
import type { WorkspaceMemberOption } from '@/components/tasks/TaskAssigneeCell';
import { TaskBulkSelectionBar } from '@/components/tasks/TaskBulkSelectionBar';
import { TaskBulkDeleteDialog } from '@/components/tasks/TaskBulkDeleteDialog';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { isTaskCompleted, isTaskDueOverdue } from '@/lib/overview-task-utils';
import { useWorkspaceRole } from '@/lib/use-workspace-role';

const metaColumnCell = 'min-w-0 border-l border-slate-200 pl-3';

type StatusesByList = Record<number, StatusesResponse[]>;

type DuePreset = 'all' | 'no_due' | 'has_due' | 'overdue' | 'today' | 'week' | 'month' | 'custom';

const normalizeCollection = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  const raw = value as { content?: T[]; data?: T[] };
  if (raw?.content && Array.isArray(raw.content)) return raw.content as T[];
  if (raw?.data && Array.isArray(raw.data)) return raw.data as T[];
  if (raw) return [raw as T];
  return [];
};

const toDateInputValue = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toBackendDueDate = (dateValue: string) => (dateValue ? `${dateValue}T23:59:59` : null);

const isOverdue = (task: Pick<DashboardTask, 'dueDate' | 'status' | 'statusGroup' | 'completedAt'>) =>
  isTaskDueOverdue(task);

const formatYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dueBounds = (preset: DuePreset, customFrom: string, customTo: string): { from: string | null; to: string | null } => {
  if (preset === 'custom') return { from: customFrom || null, to: customTo || null };
  if (preset === 'all' || preset === 'no_due' || preset === 'has_due' || preset === 'overdue') {
    return { from: null, to: null };
  }
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

export type TaskListTabProps = {
  listId?: number | null;
};

export default function TaskListTab({ listId }: TaskListTabProps) {
  const params = useParams();
  const projectId = params.projectId as string;
  const projectNum = Number(projectId);

  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [lists, setLists] = useState<ProjectListResponse[]>([]);
  const [statuses, setStatuses] = useState<StatusesResponse[]>([]);
  const [statusesByListState, setStatusesByListState] = useState<StatusesByList>({});
  const [taskStatusIds, setTaskStatusIds] = useState<Record<string, number>>({});
  const [currentUser, setCurrentUser] = useState<{ userId: number; fullName: string; avatarUrl: string | null } | null>(null);
  const { canEdit, canManageProjectStructure, canCreateTask, canManageTaskAssignments } =
    useWorkspaceRole();
  /** Mọi userId được gán (từ API task-assignees) — dùng cho filter + “assigned to me”. */
  const [assigneeUserIdsByTask, setAssigneeUserIdsByTask] = useState<Record<string, number[]>>({});
  const [createdByOptions, setCreatedByOptions] = useState<{ userId: number; name: string }[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [subtaskParentForDialog, setSubtaskParentForDialog] = useState<DashboardTask | null>(null);
  const [projectWorkspaceId, setProjectWorkspaceId] = useState<number | null>(null);
  const [collapsedLists, setCollapsedLists] = useState<Record<number, boolean>>({});
  /** Key `listProjectId-statusId` — true = nhóm status đang thu gọn (ẩn bảng task). */
  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<Record<string, boolean>>({});
  const [selectedListForRename, setSelectedListForRename] = useState<ProjectListResponse | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedListForDelete, setSelectedListForDelete] = useState<ProjectListResponse | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const [savingTaskIds, setSavingTaskIds] = useState<Record<string, boolean>>({});
  const [prioritySavingTaskIds, setPrioritySavingTaskIds] = useState<Record<string, boolean>>({});
  const [dueDateSavingTaskIds, setDueDateSavingTaskIds] = useState<Record<string, boolean>>({});
  const [dueDateDrafts, setDueDateDrafts] = useState<Record<string, string>>({});
  const [workspaceMembersForPicker, setWorkspaceMembersForPicker] = useState<WorkspaceMemberOption[]>([]);
  const [assigneeSavingByTask, setAssigneeSavingByTask] = useState<Record<string, boolean>>({});
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  /** Cache user profiles cho assignee display + member picker (đồng bộ sau add/remove). */
  const userCacheRef = useRef<Map<number, UserResponse | null>>(new Map());

  /** List / status group user đã bấm collapse — không ghi đè bởi auto cho đến khi đổi filter/context. */
  const manualListCollapseRef = useRef<Set<number>>(new Set());
  const manualStatusCollapseRef = useRef<Set<string>>(new Set());
  const prevFilterSignatureRef = useRef<string>('');

  const isProjectScope = !listId;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await getCurrentUser();
      setCurrentUser({
        userId: me.userId,
        fullName: me.fullName?.trim() || me.username || 'You',
        avatarUrl: me.avatarUrl ?? null,
      });

      const [rawTasks, listStatusRows, project] = await Promise.all([
        listId ? listTaskResponsesByList(listId) : listTaskResponsesByProject(projectNum),
        getProjectListsStatuses(projectNum),
        getProjectById(projectNum),
      ]);

      let membersRaw: WorkspaceMemberResponse[] = [];
      try {
        membersRaw = await listWorkspaceMembers(project.workspaceId);
      } catch {
        membersRaw = [];
      }
      // roleInWorkspace lấy từ workspace snapshot (được hydrate khi login / switch workspace)

      const userById = new Map<number, UserResponse | null>();
      userById.set(me.userId, me);
      for (const mem of membersRaw) {
        if (!userById.has(mem.userId)) {
          const u = await getUserById(mem.userId).catch(() => null);
          userById.set(mem.userId, u);
        }
      }

      const listData = normalizeCollection<ProjectListWithStatusesResponse>(listStatusRows?.lists ?? []);
      const statusData = listData.flatMap((list) => normalizeCollection<StatusesResponse>(list.statuses ?? []));
      setLists(listData.map(({ statuses: _statuses, ...list }) => list));
      setStatuses(statusData);

      const byList: StatusesByList = {};
      statusData.forEach((s) => {
        if (!byList[s.listId]) byList[s.listId] = [];
        byList[s.listId].push(s);
      });
      Object.keys(byList).forEach((k) => {
        byList[Number(k)] = sortStatuses(byList[Number(k)]);
      });
      setStatusesByListState(byList);

      const allRaw = rawTasks || [];
      const subCountByParent = countDirectSubtasksByParentId(
        allRaw.map((t) => ({ taskId: t.taskId, parentTaskId: t.parentTaskId })),
      );
      const rootsOnlyRaw = allRaw.filter((t) => t.parentTaskId == null);

      const bundles = await Promise.all(
        rootsOnlyRaw.map(async (t) => {
          const [tags, assignees] = await Promise.all([
            getTaskTags(t.taskId).catch(() => []),
            getTaskAssignees(t.taskId).catch(() => []),
          ]);
          const listStatuses = byList[t.listId] ?? [];
          const matched = listStatuses.find((s) => s.statusId === t.statusId) ?? null;
          const row = toDashboardTask(
            t,
            assignees,
            me.userId,
            me.fullName?.trim() || me.username || 'User',
            tags,
            matched,
          );
          return { row, assignees };
        }),
      );

      const uniqueAssigneeUserIds = [...new Set(bundles.flatMap((b) => b.assignees.map((a) => a.userId)))];
      const reporterUserIds = [...new Set(rootsOnlyRaw.map((t) => t.reporterId))];
      const candidateUserIdsSet = new Set<number>([
        me.userId,
        ...membersRaw.map((m) => m.userId),
        ...uniqueAssigneeUserIds,
        ...reporterUserIds,
      ]);
      const candidateUserIds = [...candidateUserIdsSet];
      for (const id of candidateUserIds) {
        if (!userById.has(id)) {
          const u = await getUserById(id).catch(() => null);
          userById.set(id, u);
        }
      }

      userCacheRef.current = userById;

      const memberOptions: WorkspaceMemberOption[] = candidateUserIds
        .map((userId) => {
          const u = userById.get(userId);
          return {
            userId,
            displayName: u?.fullName?.trim() || u?.username || `User #${userId}`,
            email: u?.email ?? '',
            avatarUrl: u?.avatarUrl ?? null,
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      setWorkspaceMembersForPicker(memberOptions);

      const mappedTasks: DashboardTask[] = bundles.map((b) => {
        const assigneesDisplay = taskAssigneeRowsToDisplay(b.assignees, userById);
        return {
          ...b.row,
          assigneesDisplay,
          directSubtaskCount: subCountByParent.get(b.row.taskId) ?? 0,
        };
      });

      const assigneeIdsMap: Record<string, number[]> = {};
      mappedTasks.forEach((t) => {
        assigneeIdsMap[t.id] = t.assigneesDisplay?.map((a) => a.userId) ?? [];
      });
      setAssigneeUserIdsByTask(assigneeIdsMap);
      setTasks(mappedTasks);
      setTaskStatusIds(Object.fromEntries(mappedTasks.map((t) => [t.id, t.statusId])));
      setDueDateDrafts(Object.fromEntries(mappedTasks.map((t) => [t.id, toDateInputValue(t.dueDate)])));

      const reporterIds = [...new Set(mappedTasks.map((t) => t.reporterId))];
      const reporters = reporterIds
        .map((id) => userById.get(id) ?? null)
        .filter((u): u is NonNullable<typeof u> => Boolean(u));
      setCreatedByOptions(
        reporters
          .map((u) => ({ userId: u.userId, name: u.fullName?.trim() || u.username || `User #${u.userId}` }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );

      const tagSet = new Set<string>();
      mappedTasks.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
      setTagOptions(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
      setProjectWorkspaceId(project.workspaceId);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof ApiError ? e.message : 'Could not load tasks.');
      setTasks([]);
      setAssigneeUserIdsByTask({});
      setWorkspaceMembersForPicker([]);
      setProjectWorkspaceId(null);
   } finally {
      setLoading(false);
    }
  }, [listId, projectNum]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTaskTagsChange = useCallback((taskId: string, rows: TaskTagResponse[]) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              tags: rows.map((r) => r.tagName),
              tagEntries: rows.map((r) => ({
                tagId: r.tagId,
                tagName: r.tagName,
                tagColor: r.tagColor || '#94a3b8',
              })),
            }
          : t,
      ),
    );
    setTagOptions((prev) => {
      const s = new Set(prev);
      rows.forEach((r) => s.add(r.tagName));
      return Array.from(s).sort((a, b) => a.localeCompare(b));
    });
  }, []);

  const refreshTaskAssignees = useCallback(async (task: DashboardTask) => {
    const rows = await getTaskAssignees(task.taskId);
    const map = userCacheRef.current;
    await Promise.all(
      rows.map(async (r) => {
        if (!map.has(r.userId)) {
          try {
            const u = await getUserById(r.userId);
            map.set(r.userId, u);
          } catch {
            map.set(r.userId, null);
          }
        }
      }),
    );
    const display = taskAssigneeRowsToDisplay(rows, map);
    const ids = assigneeUserIdsFromRows(rows);
    const primary = pickPrimaryAssignee(rows, currentUser?.userId ?? 0);
    const assigneeLabel = primary
      ? primary.fullName?.trim() || primary.username || `User #${primary.userId}`
      : '';

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              assigneesDisplay: display,
              assignee: assigneeLabel,
            }
          : t,
      ),
    );
    setAssigneeUserIdsByTask((prev) => ({ ...prev, [task.id]: ids }));
  }, [currentUser?.userId]);

  const handleAddTaskAssignee = useCallback(
    async (task: DashboardTask, userId: number) => {
      if (!canEdit) return;
      const n = task.assigneesDisplay?.length ?? 0;
      setAssigneeSavingByTask((s) => ({ ...s, [task.id]: true }));
      setError(null);
      try {
        await addTaskAssignee(task.taskId, { userId, isPrimary: n === 0 });
        await refreshTaskAssignees(task);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not add assignee.');
      } finally {
        setAssigneeSavingByTask((s) => ({ ...s, [task.id]: false }));
      }
    },
    [canEdit, refreshTaskAssignees],
  );

  const handleRemoveTaskAssignee = useCallback(
    async (task: DashboardTask, userId: number) => {
      if (!canEdit) return;
      setAssigneeSavingByTask((s) => ({ ...s, [task.id]: true }));
      setError(null);
      try {
        await removeTaskAssignee(task.taskId, userId);
        await refreshTaskAssignees(task);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not remove assignee.');
      } finally {
        setAssigneeSavingByTask((s) => ({ ...s, [task.id]: false }));
      }
    },
    [canEdit, refreshTaskAssignees],
  );

  const assignedTasks = useMemo(() => {
    return tasks.map((task) => {
      const sid = taskStatusIds[task.id] ?? task.statusId;
      const listStatuses = statusesByListState[task.listId] ?? [];
      const matched = listStatuses.find((s) => s.statusId === sid);
      return {
        ...task,
        statusId: sid,
        status: matched ? formatStatusLabel(matched) : task.status,
        statusGroup: matched ? String(matched.statusGroup ?? '') : task.statusGroup,
      };
    });
  }, [tasks, taskStatusIds, statusesByListState]);

  const assigneeOptions = useMemo(() => {
    const m = new Map<number, string>();
    tasks.forEach((t) => {
      t.assigneesDisplay?.forEach((a) => {
        if (!m.has(a.userId)) m.set(a.userId, a.displayName);
      });
    });
    if (currentUser) {
      m.set(currentUser.userId, currentUser.fullName);
    }
    return Array.from(m.entries())
      .map(([userId, name]) => ({ userId, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, currentUser]);

  const statusFilterOptions = useMemo(() => {
    if (isProjectScope) {
      const uniqByGroup = new Map<string, StatusesResponse>();
      statuses.forEach((s) => {
        const groupKey = String(s.statusGroup ?? '').trim().toLowerCase();
        if (!uniqByGroup.has(groupKey)) uniqByGroup.set(groupKey, s);
      });
      return [...uniqByGroup.values()]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((s) => ({ value: s.statusId, label: formatStatusLabel(s) }));
    }

    const uniqByStatusId = new Map<number, StatusesResponse>();
    statuses.forEach((s) => {
      if (!uniqByStatusId.has(s.statusId)) uniqByStatusId.set(s.statusId, s);
    });
    return [...uniqByStatusId.values()]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((s) => ({ value: s.statusId, label: formatStatusLabel(s) }));
  }, [isProjectScope, statuses]);

  const listFilterOptions = useMemo(() => {
    return [...lists]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((list) => ({ id: list.listProjectId, name: list.name }));
  }, [lists]);

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
  }, [
    filterTaskStatusIds,
    filterListIds,
    filterTagNames,
    filterPriorities,
    filterAssigneeIds,
    filterReporterIds,
    duePreset,
    assignedToMeOnly,
  ]);

  const filteredTasks = useMemo(() => {
    return assignedTasks.filter((task) => {
      if (assignedToMeOnly && currentUser) {
        const ids = assigneeUserIdsByTask[task.id] ?? [];
        if (!ids.includes(currentUser.userId)) return false;
      }
      if (filterTaskStatusIds.length > 0 && !filterTaskStatusIds.includes(task.statusId)) return false;
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
      if (duePreset === 'overdue' && !isOverdue(task)) return false;
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
    assignedTasks,
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
  ]);

  const displayedLists = useMemo(
    () => (listId ? lists.filter((l) => l.listProjectId === listId) : lists),
    [listId, lists],
  );

  const visibleLists = useMemo(
    () =>
      filterListIds.length > 0
        ? displayedLists.filter((l) => filterListIds.includes(l.listProjectId))
        : displayedLists,
    [displayedLists, filterListIds],
  );

  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        projectNum,
        listId: listId ?? null,
        filterTaskStatusIds,
        filterListIds,
        filterTagNames,
        filterPriorities,
        filterAssigneeIds,
        filterReporterIds,
        duePreset,
        customDueFrom,
        customDueTo,
        assignedToMeOnly,
      }),
    [
      projectNum,
      listId,
      filterTaskStatusIds,
      filterListIds,
      filterTagNames,
      filterPriorities,
      filterAssigneeIds,
      filterReporterIds,
      duePreset,
      customDueFrom,
      customDueTo,
      assignedToMeOnly,
    ],
  );

  /** Mặc định: có task (sau filter) => expand; không có => collapse. User chỉnh tay được lưu tới khi đổi filter. */
  useEffect(() => {
    if (prevFilterSignatureRef.current !== filterSignature) {
      prevFilterSignatureRef.current = filterSignature;
      manualListCollapseRef.current.clear();
      manualStatusCollapseRef.current.clear();
    }

    setCollapsedLists((prev) => {
      const next = { ...prev };
      for (const list of visibleLists) {
        const listTaskCount = filteredTasks.filter((t) => t.listId === list.listProjectId).length;
        const autoCollapsed = listTaskCount === 0;
        if (!manualListCollapseRef.current.has(list.listProjectId)) {
          next[list.listProjectId] = autoCollapsed;
        }
      }
      return next;
    });

    setCollapsedStatusGroups((prev) => {
      const next = { ...prev };
      for (const list of visibleLists) {
        const listTasks = filteredTasks.filter((t) => t.listId === list.listProjectId);
        const listStatuses = statuses
          .filter((s) => s.listId === list.listProjectId)
          .sort((a, b) => a.position - b.position);
        const tasksByStatusId = listTasks.reduce(
          (acc, task) => {
            const key = String(taskStatusIds[task.id] ?? task.statusId);
            if (!acc[key]) acc[key] = [];
            acc[key].push(task);
            return acc;
          },
          {} as Record<string, DashboardTask[]>,
        );
        for (const status of listStatuses) {
          const k = `${list.listProjectId}-${status.statusId}`;
          const groupTasks = tasksByStatusId[String(status.statusId)] || [];
          const autoCollapsed = groupTasks.length === 0;
          if (!manualStatusCollapseRef.current.has(k)) {
            next[k] = autoCollapsed;
          }
        }
      }
      return next;
    });
  }, [filteredTasks, visibleLists, statuses, taskStatusIds, filterSignature]);

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
    if (!canEdit) return;
    const numericIds = selectedTaskIds.map((id) => Number(id));
    if (numericIds.length === 0) return;
    setBulkDeleting(true);
    setError(null);
    try {
      const { succeeded, failed } = await deleteTasksByIds(numericIds);
      const succSet = new Set(succeeded);
      setTasks((prev) => prev.filter((t) => !succSet.has(t.taskId)));
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
      setAssigneeUserIdsByTask((prev) => {
        const next = { ...prev };
        succeeded.forEach((tid) => {
          delete next[String(tid)];
        });
        return next;
      });
      setSelectedTaskIds((prev) => prev.filter((id) => !succSet.has(Number(id))));
      setBulkDeleteDialogOpen(false);
      if (failed.length > 0) {
        setError(
          `Deleted ${succeeded.length} task(s). ${failed.length} failed: ${failed.map((f) => f.message).join('; ')}`,
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete tasks.');
    } finally {
      setBulkDeleting(false);
    }
  }, [canEdit, selectedTaskIds]);

  const getStatusOptions = (task: DashboardTask) => sortStatuses(statusesByListState[task.listId] ?? []);

  const handleTaskStatusChange = async (task: DashboardTask, nextStatusId: number) => {
    if (!canEdit) return;
    const nextStatus = getStatusOptions(task).find((s) => s.statusId === nextStatusId);
    if (!nextStatus) return;
    const previousStatusId = taskStatusIds[task.id] ?? task.statusId;
    if (nextStatusId === previousStatusId) return;
    const bucket = statusVisualBucketFromGroup(String(nextStatus.statusGroup ?? ''));
    const now = new Date().toISOString().slice(0, 19);
    const nextStartDate = bucket === 'todo' ? '' : task.startDate || now;
    const nextCompletedAt = bucket === 'completed' ? now : '';

    setTaskStatusIds((c) => ({ ...c, [task.id]: nextStatus.statusId }));
    setSavingTaskIds((c) => ({ ...c, [task.id]: true }));
    setError(null);
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
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                statusId: updatedTask.statusId,
                startDate: updatedTask.startDate ?? '',
                completedAt: updatedTask.completedAt ?? '',
                status: formatStatusLabel(nextStatus),
                statusGroup: String(nextStatus.statusGroup ?? ''),
                statusColor: nextStatus.color ?? null,
                taskType: updatedTask.taskType,
                timeEstimateDays: updatedTask.timeEstimateDays,
                updatedAt: updatedTask.updatedAt,
              }
            : item,
        ),
      );
      setTaskStatusIds((c) => ({ ...c, [task.id]: updatedTask.statusId }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not update status.';
      setTaskStatusIds((c) => ({ ...c, [task.id]: previousStatusId }));
      setError(message);
    } finally {
      setSavingTaskIds((c) => ({ ...c, [task.id]: false }));
    }
  };

  const handleTaskPriorityChange = async (task: DashboardTask, nextPriority: Task['priority']) => {
    if (!canEdit) return;
    if (task.priority === nextPriority) return;
    const previousPriority = task.priority;
    setTasks((c) => c.map((item) => (item.id === task.id ? { ...item, priority: nextPriority } : item)));
    setPrioritySavingTaskIds((c) => ({ ...c, [task.id]: true }));
    setError(null);
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
      setTasks((current) =>
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
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not update priority.';
      setTasks((c) => c.map((item) => (item.id === task.id ? { ...item, priority: previousPriority } : item)));
      setError(message);
    } finally {
      setPrioritySavingTaskIds((c) => ({ ...c, [task.id]: false }));
    }
  };

  const handleTaskDueDateChange = async (task: DashboardTask, dateInput: string) => {
    if (!canEdit) return;
    const previousDueDate = task.dueDate;
    const nextDueDate = toBackendDueDate(dateInput);
    setTasks((c) => c.map((item) => (item.id === task.id ? { ...item, dueDate: nextDueDate ?? '' } : item)));
    setDueDateSavingTaskIds((c) => ({ ...c, [task.id]: true }));
    setError(null);
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
      setTasks((current) =>
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
      setDueDateDrafts((c) => ({ ...c, [task.id]: toDateInputValue(updatedTask.dueDate ?? '') }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not update due date.';
      setTasks((c) => c.map((item) => (item.id === task.id ? { ...item, dueDate: previousDueDate } : item)));
      setDueDateDrafts((c) => ({ ...c, [task.id]: toDateInputValue(previousDueDate) }));
      setError(message);
    } finally {
      setDueDateSavingTaskIds((c) => ({ ...c, [task.id]: false }));
    }
  };

  const handleToggleList = (listProjectId: number) => {
    manualListCollapseRef.current.add(listProjectId);
    setCollapsedLists((c) => {
      const cur = Boolean(c[listProjectId]);
      return { ...c, [listProjectId]: !cur };
    });
  };

  const statusGroupKey = (listProjectId: number, statusId: number) => `${listProjectId}-${statusId}`;

  const toggleStatusGroup = (listProjectId: number, statusId: number) => {
    const k = statusGroupKey(listProjectId, statusId);
    manualStatusCollapseRef.current.add(k);
    setCollapsedStatusGroups((prev) => {
      const cur = Boolean(prev[k]);
      return { ...prev, [k]: !cur };
    });
  };

  const handleListCreated = async () => {
    await loadData();
    window.dispatchEvent(new Event('enflow:lists-changed'));
  };

  const handleRenameClick = (list: ProjectListResponse) => {
    setSelectedListForRename(list);
    setRenameDialogOpen(true);
  };

  const handleDeleteClick = (list: ProjectListResponse) => {
    setSelectedListForDelete(list);
    setDeleteDialogOpen(true);
  };

  const handleListUpdated = async () => {
    await loadData();
    window.dispatchEvent(new Event('enflow:lists-changed'));
  };

  const toggleNumber = (list: number[], id: number, set: (v: number[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading…</div>;
  }

  if (error && tasks.length === 0) {
    return <div className="p-8 text-center text-red-600 font-medium">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <CreateListDialog
        open={createListOpen}
        onOpenChange={setCreateListOpen}
        projectId={projectNum}
        lists={lists}
        onCreated={handleListCreated}
      />
      <RenameListDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        list={selectedListForRename}
        onUpdated={handleListUpdated}
      />
      <DeleteListDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        list={selectedListForDelete}
        onDeleted={handleListUpdated}
      />
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={(open) => {
          setCreateTaskOpen(open);
          if (!open) setSubtaskParentForDialog(null);
        }}
        lockedProjectId={projectNum}
        defaultListId={subtaskParentForDialog?.listId ?? listId ?? undefined}
        parentTaskId={subtaskParentForDialog?.taskId ?? undefined}
        onCreated={() => void loadData()}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          {isProjectScope ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setCreateListOpen(true)}
              disabled={!canManageProjectStructure}
            >
              <Plus className="w-4 h-4" />
              Create List
            </Button>
          ) : null}
        </div>
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
                  <Badge className="h-5 min-w-5 rounded-full bg-[#0057b8] px-1.5 text-[10px] text-white">{filterActiveCount}</Badge>
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
                              setFilterTagNames((prev) =>
                                prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
                              )
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
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-full text-xs text-slate-600"
                  onClick={() => {
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
                  }}
                >
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

          <Button
            type="button"
            className="gap-2 bg-[#0057b8] hover:bg-[#00489a]"
            onClick={() => {
              setSubtaskParentForDialog(null);
              setCreateTaskOpen(true);
            }}
            disabled={!canCreateTask}
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      {filteredTasks.length > 0 && canManageProjectStructure ? (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Checkbox
              checked={someFilteredSelected ? 'indeterminate' : allFilteredSelected}
              onCheckedChange={handleToggleSelectAllFiltered}
              aria-label="Select all tasks in current view"
              className="border-slate-300"
            />
            <span className="text-sm text-slate-700">
              {selectedTaskIds.length > 0 ? (
                <span className="font-medium">{selectedTaskIds.length} selected</span>
              ) : (
                <span className="text-slate-500">{filteredTasks.length} tasks in view</span>
              )}
            </span>
          </div>
          {selectedTaskIds.length > 0 ? (
            <TaskBulkSelectionBar
              count={selectedTaskIds.length}
              onDelete={() => setBulkDeleteDialogOpen(true)}
              onClear={() => setSelectedTaskIds([])}
              deleting={bulkDeleting}
            />
          ) : null}
        </div>
      ) : null}

      {displayedLists.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
          <div>{isProjectScope ? 'No lists in this project yet.' : 'No lists found.'}</div>
          {isProjectScope ? (
            <Button
              type="button"
              onClick={() => setCreateListOpen(true)}
              className="gap-2"
              disabled={!canManageProjectStructure}
            >
              <Plus className="w-4 h-4" />
              Create List
            </Button>
          ) : null}
        </div>
      ) : null}

      {visibleLists.map((list) => {
        const listTasks = filteredTasks.filter((t) => t.listId === list.listProjectId);
        const listStatuses = statuses.filter((s) => s.listId === list.listProjectId).sort((a, b) => a.position - b.position);
        const tasksByStatusId = listTasks.reduce(
          (acc, task) => {
            const key = String(taskStatusIds[task.id] ?? task.statusId);
            if (!acc[key]) acc[key] = [];
            acc[key].push(task);
            return acc;
          },
          {} as Record<string, DashboardTask[]>,
        );
        const isCollapsed = Boolean(collapsedLists[list.listProjectId]);

        return (
          <div key={list.listProjectId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900"
                  onClick={() => handleToggleList(list.listProjectId)}
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <span className="h-6 w-1.5 shrink-0 rounded-sm bg-blue-500" />
                <h2 className="truncate text-lg font-bold text-slate-800">{list.name}</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                    aria-label={`Options for ${list.name}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  {canEdit ? (
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => handleRenameClick(list)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-red-600" onClick={() => handleDeleteClick(list)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  ) : null}
                </DropdownMenu>
              </div>
              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {listTasks.length} Tasks
              </span>
            </div>

            {!isCollapsed ? (
              <div className="space-y-6 bg-slate-50/30 p-4 sm:p-6">
                {listStatuses.length > 0 ? (
                  listStatuses.map((status) => {
                    const groupTasks = tasksByStatusId[String(status.statusId)] || [];
                    const sectionDot = sectionStatusDotPresentation(status.statusGroup, status.color);
                    const sgKey = statusGroupKey(list.listProjectId, status.statusId);
                    const statusCollapsed = Boolean(collapsedStatusGroups[sgKey]);
                    return (
                      <div key={status.statusId} className="space-y-2">
                        <button
                          type="button"
                          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/90"
                          onClick={() => toggleStatusGroup(list.listProjectId, status.statusId)}
                          aria-expanded={!statusCollapsed}
                          aria-controls={`status-group-${sgKey}`}
                          id={`status-group-hdr-${sgKey}`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-500">
                              {statusCollapsed ? (
                                <ChevronRight className="h-4 w-4" aria-hidden />
                              ) : (
                                <ChevronDown className="h-4 w-4" aria-hidden />
                              )}
                            </span>
                            <span className={sectionDot.className} style={sectionDot.style} aria-hidden />
                            <span className="truncate text-sm font-semibold text-slate-800">{formatStatusLabel(status)}</span>
                          </span>
                          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                            {groupTasks.length}
                          </span>
                        </button>

                        {!statusCollapsed ? (
                          groupTasks.length === 0 ? (
                            <div className="rounded-md border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                              No tasks
                            </div>
                          ) : (
                            <div
                              id={`status-group-${sgKey}`}
                              role="region"
                              aria-labelledby={`status-group-hdr-${sgKey}`}
                              className="overflow-hidden rounded-md border border-slate-200 bg-white"
                            >
                              <ScrollArea className="max-h-[min(480px,55vh)]">
                              <div className="min-w-[1120px]">
                                <div
                                  className={cn(
                                    TASK_TABLE_GRID_WITH_ASSIGNEE,
                                    'items-center border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500',
                                  )}
                                >
                                  <div className="w-7 shrink-0" aria-hidden />
                                  <div className="min-w-0">Task</div>
                                    <div className="min-w-0">Project</div>
                                    <div className="min-w-0">List</div>
                                    <div className="min-w-0">Assignee</div>
                                    <div className={cn(metaColumnCell, 'whitespace-nowrap text-left')}>Status</div>
                                    <div className={cn(metaColumnCell, 'whitespace-nowrap text-left')}>Priority</div>
                                    <div className={cn(metaColumnCell, 'whitespace-nowrap text-left')}>Due Date</div>
                                  </div>
                                  {groupTasks.map((task) => (
                                  <TaskTableRow
                                    key={task.id}
                                    task={task}
                                    statuses={getStatusOptions(task)}
                                    currentStatusId={taskStatusIds[task.id] ?? task.statusId}
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
                                    readOnly={!canEdit}
                                    layout="withAssignees"
                                    taskDetailHref={`/app/tasks/${task.id}`}
                                      onStatusChange={handleTaskStatusChange}
                                      onPriorityChange={handleTaskPriorityChange}
                                      dueDateDraft={dueDateDrafts[task.id] ?? ''}
                                      onDueDateDraftChange={(value) => setDueDateDrafts((c) => ({ ...c, [task.id]: value }))}
                                      onDueDateSave={(value) => {
                                        if (value === toDateInputValue(task.dueDate)) return;
                                        void handleTaskDueDateChange(task, value);
                                      }}
                                      statusSaving={Boolean(savingTaskIds[task.id])}
                                      prioritySaving={Boolean(prioritySavingTaskIds[task.id])}
                                      dueDateSaving={Boolean(dueDateSavingTaskIds[task.id])}
                                      selectionDisabled={!canManageProjectStructure}
                                      statusEditable={canEdit}
                                      priorityEditable={canManageProjectStructure}
                                      dueDateEditable={canManageProjectStructure}
                                      assigneeEditable={canManageTaskAssignments}
                                      workspaceMembersForAssignee={workspaceMembersForPicker}
                                      assigneeSaving={Boolean(assigneeSavingByTask[task.id])}
                                      onAddTaskAssignee={handleAddTaskAssignee}
                                      onRemoveTaskAssignee={handleRemoveTaskAssignee}
                                      workspaceId={projectWorkspaceId}
                                      onAddSubtask={
                                        canCreateTask
                                          ? (t) => {
                                              setSubtaskParentForDialog(t);
                                              setCreateTaskOpen(true);
                                            }
                                          : undefined
                                      }
                                      onTaskTagsChange={canEdit ? handleTaskTagsChange : undefined}
                                    />
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">No status columns for this list.</p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {canManageProjectStructure ? (
        <TaskBulkDeleteDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          count={selectedTaskIds.length}
          onConfirm={runBulkDelete}
          deleting={bulkDeleting}
        />
      ) : null}
    </div>
  );
}
