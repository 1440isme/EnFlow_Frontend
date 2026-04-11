'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/components/ui/utils';
import { addTagToTask, getTaskTags, type TaskTagResponse } from '@/lib/task-api';
import { createTagInWorkspace, listTagsByWorkspace, type WorkspaceTagResponse } from '@/lib/tag-api';
import { pickDistinctTagColor } from '@/lib/tag-color';
import { ApiError } from '@/lib/http';

export type TaskRowTagPopoverProps = {
  taskId: number;
  workspaceId: number;
  currentTagNames: string[];
  onTagsUpdated: (rows: TaskTagResponse[]) => void;
  /** stopPropagation on trigger so parent row does not receive the click */
  className?: string;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function TaskRowTagPopover({
  taskId,
  workspaceId,
  currentTagNames,
  onTagsUpdated,
  className,
}: TaskRowTagPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTagResponse[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaceTags = useCallback(async () => {
    setLoadingTags(true);
    setError(null);
    try {
      const list = await listTagsByWorkspace(workspaceId);
      setWorkspaceTags(list ?? []);
    } catch (e) {
      setWorkspaceTags([]);
      setError(e instanceof ApiError ? e.message : 'Could not load tags.');
    } finally {
      setLoadingTags(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!open) return;
    void loadWorkspaceTags();
  }, [open, loadWorkspaceTags]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setError(null);
    }
  }, [open]);

  const q = query.trim();
  const qNorm = q ? norm(q) : '';

  const filteredExisting = useMemo(() => {
    if (!qNorm) return workspaceTags.slice().sort((a, b) => a.name.localeCompare(b.name));
    return workspaceTags
      .filter((t) => norm(t.name).includes(qNorm))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workspaceTags, qNorm]);

  const exactWorkspaceMatch = useMemo(
    () => workspaceTags.find((t) => norm(t.name) === qNorm),
    [workspaceTags, qNorm],
  );

  const showCreateRow =
    q.length > 0 && !exactWorkspaceMatch && !currentTagNames.some((n) => norm(n) === qNorm);

  const refreshTaskTagNames = async () => {
    const rows = await getTaskTags(taskId);
    onTagsUpdated(rows);
  };

  const attachTagId = async (tagId: number) => {
    await addTagToTask(taskId, tagId);
    await refreshTaskTagNames();
    setOpen(false);
  };

  const handlePickWorkspaceTag = async (t: WorkspaceTagResponse) => {
    if (currentTagNames.some((n) => norm(n) === norm(t.name))) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await attachTagId(t.tagId);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        await refreshTaskTagNames();
        setOpen(false);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAndAttach = async () => {
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const color = pickDistinctTagColor(workspaceTags.map((t) => t.color));
      const created = await createTagInWorkspace(workspaceId, { name: q, color });
      setWorkspaceTags((prev) => {
        const next = [...prev.filter((x) => x.tagId !== created.tagId), created];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      await attachTagId(created.tagId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create tag.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy}
          className={cn(
            'size-7 shrink-0 text-slate-500 hover:bg-slate-200/80 hover:text-slate-900',
            className,
          )}
          aria-label="Add tag"
          title="Add tag"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Tag className="size-3.5" strokeWidth={2} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-[100] w-[min(100vw-2rem,18rem)] p-0"
        sideOffset={6}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or add tags…"
            className="h-8 border-slate-200 text-sm"
            disabled={busy}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredExisting.length === 1 && !showCreateRow) {
                  void handlePickWorkspaceTag(filteredExisting[0]);
                } else if (exactWorkspaceMatch) {
                  void handlePickWorkspaceTag(exactWorkspaceMatch);
                } else if (showCreateRow) {
                  void handleCreateAndAttach();
                }
              }
            }}
          />
        </div>
        {error ? <p className="px-3 py-2 text-xs text-rose-600">{error}</p> : null}
        <ScrollArea className="max-h-[220px]">
          <div className="p-1">
            {loadingTags ? (
              <p className="px-2 py-3 text-center text-xs text-slate-500">Loading tags…</p>
            ) : (
              <>
                {filteredExisting.map((t) => {
                  const onTask = currentTagNames.some((n) => norm(n) === norm(t.name));
                  return (
                    <button
                      key={t.tagId}
                      type="button"
                      disabled={busy || onTask}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        onTask ? 'cursor-default text-slate-400' : 'text-slate-800 hover:bg-slate-100',
                      )}
                      onClick={() => !onTask && void handlePickWorkspaceTag(t)}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full border border-slate-200"
                        style={{ backgroundColor: t.color || '#94a3b8' }}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">{t.name}</span>
                      {onTask ? <span className="ml-auto text-[10px] uppercase text-slate-400">On task</span> : null}
                    </button>
                  );
                })}
                {showCreateRow ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                    onClick={() => void handleCreateAndAttach()}
                  >
                    Create &quot;{q}&quot;
                  </button>
                ) : null}
                {!loadingTags && filteredExisting.length === 0 && !showCreateRow ? (
                  <p className="px-2 py-3 text-center text-xs text-slate-500">
                    {q ? 'No matching tags.' : 'No tags in workspace yet.'}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
