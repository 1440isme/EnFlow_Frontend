'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getListsByProject } from '@/lib/list-api';
import { getProjectById } from '@/lib/project-api';
import { getStatusesByList } from '@/lib/status-api';
import { getCurrentUser } from '@/lib/user-api';
import { getStoredUserId } from '@/lib/auth-session';
import { listWorkspaces, listWorkspacesByOwner } from '@/lib/workspace-api';
import { getProjectsByWorkspace, type ProjectResponse } from '@/lib/project-api';
import { addTaskAssignee, createTask } from '@/lib/task-api';
import { ApiError } from '@/lib/http';
import type { Task } from '@/types/task';
import type { StatusesResponse } from '@/types/api';
import { formatStatusLabel, sortStatuses } from '@/lib/task-status-ui';
import { mapFrontendPriorityToBackend } from '@/lib/dashboard-task-mapper';

function normalizeBackendStatusGroupKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

export type CreateTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Khi có — chỉ tạo task trong project này (Project Dashboard). */
  lockedProjectId?: number;
  /**
   * Prefill list (dashboard tab) hoặc — khi có `parentTaskId` — **list cố định của task cha** (bắt buộc).
   */
  defaultListId?: number | null;
  /** Task cha — backend dùng parentTaskId + taskType `subtask`. */
  parentTaskId?: number | null;
  onCreated?: () => void | Promise<void>;
};

export function CreateTaskDialog({
  open,
  onOpenChange,
  lockedProjectId,
  defaultListId,
  parentTaskId = null,
  onCreated,
}: CreateTaskDialogProps) {
  /** Subtask: project + list bắt buộc khớp task cha; không cho đổi trên UI. */
  const isSubtaskFlow =
    parentTaskId != null &&
    lockedProjectId != null &&
    defaultListId != null &&
    Number.isFinite(Number(defaultListId));

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
  const [createFormStatuses, setCreateFormStatuses] = useState<StatusesResponse[]>([]);
  const [lockedProjectLabel, setLockedProjectLabel] = useState<string>('');

  const lockedListLabel = useMemo(() => {
    const lid = defaultListId;
    if (lid == null) return '';
    const row = createLists.find((l) => l.listProjectId === lid);
    return row?.name ?? `List #${lid}`;
  }, [createLists, defaultListId]);

  const projectsForCreate = useMemo(() => {
    return [...createProjectsCatalog]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => [p.idProject, p.name] as [number, string]);
  }, [createProjectsCatalog]);

  useEffect(() => {
    if (open && parentTaskId != null) {
      setCreateTitle('');
      setCreateDescription('');
      setCreateDue('');
      setCreatePriority('medium');
    }
  }, [open, parentTaskId]);

  useEffect(() => {
    if (!open || lockedProjectId == null) {
      setLockedProjectLabel('');
      return;
    }
    void getProjectById(lockedProjectId)
      .then((p) => setLockedProjectLabel(p.name))
      .catch(() => setLockedProjectLabel(`Project #${lockedProjectId}`));
  }, [open, lockedProjectId]);

  useEffect(() => {
    if (!open) return;
    if (lockedProjectId != null) {
      setCreateProjectId(lockedProjectId);
      return;
    }
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
        if (!cancelled) setCreateCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setCreateCatalogLoading(false);
    };
  }, [open, lockedProjectId]);

  useEffect(() => {
    if (!open || lockedProjectId == null) return;
    setCreateProjectId(lockedProjectId);
  }, [open, lockedProjectId]);

  useEffect(() => {
    if (!open) return;
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
          if (
            parentTaskId != null &&
            lockedProjectId != null &&
            defaultListId != null &&
            mapped.some((m) => m.listProjectId === defaultListId)
          ) {
            return defaultListId;
          }
          if (defaultListId != null && mapped.some((m) => m.listProjectId === defaultListId)) {
            return defaultListId;
          }
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
  }, [open, createProjectId, defaultListId, parentTaskId, lockedProjectId]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, createListId]);

  useEffect(() => {
    if (!open || !isSubtaskFlow) return;
    if (lockedProjectId != null) setCreateProjectId(lockedProjectId);
    if (defaultListId != null) setCreateListId(defaultListId);
  }, [open, isSubtaskFlow, lockedProjectId, defaultListId]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setCreateError(null);
      setCreateFormStatuses([]);
      if (lockedProjectId == null) {
        setCreateTitle('');
        setCreateDescription('');
        setCreateProjectId('');
        setCreateListId('');
        setCreateStatusId('');
        setCreatePriority('medium');
        setCreateDue('');
      }
    }
  };

  const handleSubmit = async () => {
    if (createLoading) return;
    setCreateError(null);

    if (parentTaskId != null && !isSubtaskFlow) {
      setCreateError('Cannot create subtask: parent project or list context is missing.');
      return;
    }

    const submitProjectId = isSubtaskFlow ? lockedProjectId! : createProjectId;
    const submitListId = isSubtaskFlow ? defaultListId! : createListId;

    if (
      !createTitle.trim() ||
      submitProjectId === '' ||
      submitListId === '' ||
      createStatusId === '' ||
      typeof submitProjectId !== 'number' ||
      typeof submitListId !== 'number' ||
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
      const created = await createTask(submitProjectId, submitListId, createStatusId, {
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        taskType: parentTaskId != null ? 'subtask' : 'task',
        parentTaskId: parentTaskId ?? null,
        priority: mapFrontendPriorityToBackend(createPriority),
        reporterId: user.userId,
        dueDate: createDue ? `${createDue}T23:59:59` : null,
      });
      await addTaskAssignee(created.taskId, { userId: user.userId, isPrimary: true });
      handleOpenChange(false);
      setCreateTitle('');
      setCreateDescription('');
      if (lockedProjectId == null) {
        setCreateProjectId('');
        setCreateListId('');
        setCreateStatusId('');
      }
      setCreatePriority('medium');
      setCreateDue('');
      setCreateError(null);
      setCreateFormStatuses([]);
      await onCreated?.();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not create task.';
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const submitProjectIdForDisabled = isSubtaskFlow ? lockedProjectId : createProjectId;
  const submitListIdForDisabled = isSubtaskFlow ? defaultListId : createListId;

  const createSubmitDisabled =
    createLoading ||
    createCatalogLoading ||
    createListsLoading ||
    createStatusesLoading ||
    (parentTaskId != null && !isSubtaskFlow) ||
    (lockedProjectId == null && !isSubtaskFlow && projectsForCreate.length === 0) ||
    !createTitle.trim() ||
    submitProjectIdForDisabled === '' ||
    submitListIdForDisabled === '' ||
    createStatusId === '';

  const descriptionText =
    parentTaskId != null
      ? 'New subtask will be created under the parent task and assigned to you by default.'
      : lockedProjectId != null
        ? 'Create a task in this project. It will be assigned to you by default.'
        : 'Add a task and assign it to yourself so it appears in My Tasks.';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,44rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="shrink-0 space-y-3 border-b border-slate-100 px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>{parentTaskId != null ? 'Create subtask' : 'Create task'}</DialogTitle>
            <DialogDescription>{descriptionText}</DialogDescription>
          </DialogHeader>
          {createError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</div>
          ) : null}
          {parentTaskId != null && !isSubtaskFlow ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Subtask requires the parent task&apos;s project and list. Close and use &quot;Add subtask&quot; from a task row.
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="shared-create-title">Title</Label>
              <Input
                id="shared-create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Task title"
                className="border-slate-200"
              />
            </div>
            {lockedProjectId == null ? (
              <div className="grid gap-1.5">
                <Label htmlFor="shared-create-project">Project</Label>
                <Select
                  value={createProjectId === '' ? undefined : String(createProjectId)}
                  onValueChange={(v) => setCreateProjectId(v ? Number(v) : '')}
                  disabled={createCatalogLoading || projectsForCreate.length === 0}
                >
                  <SelectTrigger id="shared-create-project" className="w-full border-slate-200 bg-white">
                    <SelectValue placeholder={createCatalogLoading ? 'Loading projects…' : 'Select project'} />
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
            ) : (
              <div className="grid gap-1.5">
                <Label>{isSubtaskFlow ? 'Project (parent task)' : 'Project'}</Label>
                <p
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                  aria-readonly="true"
                >
                  {lockedProjectLabel || `Project #${lockedProjectId}`}
                </p>
              </div>
            )}
            {isSubtaskFlow ? (
              <div className="grid gap-1.5">
                <Label>List (parent task)</Label>
                <p
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                  aria-readonly="true"
                >
                  {createListsLoading ? 'Loading list…' : lockedListLabel}
                </p>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="shared-create-list">List</Label>
                <Select
                  value={createListId === '' ? undefined : String(createListId)}
                  onValueChange={(v) => setCreateListId(v ? Number(v) : '')}
                  disabled={createProjectId === '' || createListsLoading}
                >
                  <SelectTrigger id="shared-create-list" className="w-full border-slate-200 bg-white">
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
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="shared-create-status">Status</Label>
              <Select
                value={createStatusId === '' ? undefined : String(createStatusId)}
                onValueChange={(v) => setCreateStatusId(v ? Number(v) : '')}
                disabled={createListId === '' || createStatusesLoading}
              >
                <SelectTrigger id="shared-create-status" className="w-full border-slate-200 bg-white">
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
              <Label htmlFor="shared-create-priority">Priority</Label>
              <Select value={createPriority} onValueChange={(v) => setCreatePriority(v as Task['priority'])}>
                <SelectTrigger id="shared-create-priority" className="w-full border-slate-200 bg-white capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shared-create-due">Due date</Label>
              <Input
                id="shared-create-due"
                type="date"
                value={createDue}
                onChange={(e) => setCreateDue(e.target.value)}
                className="border-slate-200"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shared-create-desc">Description (optional)</Label>
              <Textarea
                id="shared-create-desc"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Details…"
                rows={3}
                className="resize-none border-slate-200"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createLoading}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#0057b8] hover:bg-[#00489a]"
            disabled={createSubmitDisabled}
            onClick={() => void handleSubmit()}
          >
            {createLoading ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
