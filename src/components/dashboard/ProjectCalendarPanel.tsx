'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Task, Priority } from '@/types/task';
import type { DashboardTask } from '@/types/dashboard-task';
import type { ProjectListResponse, StatusesResponse, UserResponse } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Filter, Plus } from 'lucide-react';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { getListsByProject } from '@/lib/list-api';
import { getStatusesByList, getStatusesByProject } from '@/lib/status-api';
import {
  getTaskAssignees,
  getTaskTags,
  listTaskResponsesByList,
  listTaskResponsesByProject,
  type TaskResponse,
} from '@/lib/task-api';
import { getCurrentUser, getUserById } from '@/lib/user-api';
import { taskAssigneeRowsToDisplay } from '@/lib/task-assignee-utils';
import { toDashboardTask } from '@/lib/dashboard-task-mapper';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/components/ui/utils';
import { formatStatusLabel, sortStatuses } from '@/lib/task-status-ui';
import { formatTaskPriorityLabel, TASK_PRIORITY_DISPLAY_ORDER } from '@/lib/task-priority-ui';
import {
  type DuePreset,
  dueBounds,
  filterDashboardTasks,
  formatYmd,
  taskDueDateKey,
} from '@/lib/project-dashboard-filters';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MAX_TASKS_PER_CELL = 3;

const priorityLeftBorder: Record<Priority, string> = {
  low: 'border-l-gray-400',
  medium: 'border-l-blue-500',
  normal: 'border-l-green-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
};

type Props = {
  listId?: number | null;
  scopeLabel?: string;
};

type StatusesByList = Record<number, StatusesResponse[]>;

function normalizeCollection<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const raw = value as { content?: T[]; data?: T[] } | null | undefined;
  if (raw?.content && Array.isArray(raw.content)) return raw.content;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  return value ? ([value] as T[]) : [];
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildMonthGridCells(year: number, month: number): { day: number | null; date: Date | null }[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const pad = (first.getDay() + 6) % 7;
  const cells: { day: number | null; date: Date | null }[] = [];
  for (let i = 0; i < pad; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ day: d, date: new Date(year, month, d) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, date: null });
  }
  return cells;
}

export default function ProjectCalendarPanel({ listId, scopeLabel }: Props) {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;
  const projectNum = Number(projectId);

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [statuses, setStatuses] = useState<StatusesResponse[]>([]);
  const [lists, setLists] = useState<ProjectListResponse[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userId: number; fullName: string; avatarUrl: string | null } | null>(null);

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
      setStatuses([...statusData].sort((a, b) => a.position - b.position));

      setLists([...normalizeCollection<ProjectListResponse>(listRows)].sort((a, b) => a.position - b.position));

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
    } finally {
      setLoading(false);
    }
  }, [listId, projectId, projectNum]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dueRange = useMemo(() => dueBounds(duePreset, customDueFrom, customDueTo), [duePreset, customDueFrom, customDueTo]);

  const filteredTasks = useMemo(
    () =>
      filterDashboardTasks({
        tasks,
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
      tasks,
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

  const tasksWithDue = useMemo(() => {
    return filteredTasks.filter((t) => taskDueDateKey(t.dueDate));
  }, [filteredTasks]);

  const tasksByDateKey = useMemo(() => {
    const m = new Map<string, DashboardTask[]>();
    for (const t of tasksWithDue) {
      const key = taskDueDateKey(t.dueDate);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const pa = TASK_PRIORITY_DISPLAY_ORDER.indexOf(a.priority);
        const pb = TASK_PRIORITY_DISPLAY_ORDER.indexOf(b.priority);
        if (pa !== pb) return pa - pb;
        return a.title.localeCompare(b.title);
      });
    }
    return m;
  }, [tasksWithDue]);

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
    assignedToMeOnly,
    duePreset,
    filterAssigneeIds.length,
    filterListIds.length,
    filterPriorities.length,
    filterReporterIds.length,
    filterTaskStatusIds.length,
    filterTagNames.length,
  ]);

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
    return [...lists].sort((a, b) => a.name.localeCompare(b.name)).map((list) => ({ id: list.listProjectId, name: list.name }));
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

  const handleTaskClick = (taskId: string) => {
    router.push(`/app/tasks/${taskId}`);
  };

  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const monthCells = useMemo(() => buildMonthGridCells(y, m), [y, m]);
  const monthTitle = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const today = new Date();
  const todayKey = formatYmd(today);

  const goToday = () => setViewMonth(startOfMonth(new Date()));
  const goPrev = () => setViewMonth(new Date(y, m - 1, 1));
  const goNext = () => setViewMonth(new Date(y, m + 1, 1));

  if (loading) {
    return <div className="p-8 text-gray-500">Đang tải lịch và task…</div>;
  }

  if (error && tasks.length === 0) {
    return <div className="p-8 text-center text-red-600 font-medium">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        lockedProjectId={projectNum}
        defaultListId={listId ?? undefined}
        onCreated={() => void loadData()}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-9 border-slate-200" onClick={goToday}>
              Today
            </Button>
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={goPrev} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[10rem] text-center text-sm font-semibold text-slate-900">{monthTitle}</span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={goNext} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {scopeLabel ? <p className="text-xs text-slate-500">Phạm vi: {scopeLabel}</p> : null}
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

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid min-w-[720px] grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-w-[720px] grid-cols-7">
          {monthCells.map((cell, idx) => {
            if (cell.day == null || !cell.date) {
              return <div key={`empty-${idx}`} className="min-h-[7rem] border-b border-r border-slate-100 bg-slate-50/60 last:border-r-0" />;
            }
            const key = formatYmd(cell.date);
            const dayTasks = tasksByDateKey.get(key) ?? [];
            const isToday = key === todayKey;
            const visible = dayTasks.slice(0, MAX_TASKS_PER_CELL);
            const more = dayTasks.length - visible.length;

            return (
              <div
                key={key}
                className={cn(
                  'flex min-h-[7rem] flex-col border-b border-r border-slate-100 p-1.5 last:border-r-0',
                  isToday && 'bg-blue-50/40',
                )}
              >
                <div
                  className={cn(
                    'mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    isToday ? 'bg-[#0057b8] text-white' : 'text-slate-700',
                  )}
                >
                  {cell.day}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {visible.map((task) => {
                    const first = task.assigneesDisplay?.[0];
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleTaskClick(task.id)}
                        className={cn(
                          'w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition hover:border-[#0057b8]/40 hover:bg-blue-50/30',
                          'border-l-[3px]',
                          priorityLeftBorder[task.priority],
                        )}
                        title={task.title}
                      >
                        <span className="line-clamp-2 font-medium text-slate-900">{task.title}</span>
                        {first ? (
                          <span className="mt-0.5 block truncate text-[10px] text-slate-500">{first.displayName.split(' ')[0]}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  {more > 0 ? (
                    <span className="px-0.5 text-[10px] font-medium text-slate-500">+{more} more</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Chỉ hiển thị task có due date (sau khi áp dụng bộ lọc). Task không có hạn không xuất hiện trên lưới.
      </p>
    </div>
  );
}
