'use client';

import { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AssigneeAvatarStack } from './AssigneeAvatarStack';
import { cn } from '@/components/ui/utils';
import type { DashboardTask } from '@/types/dashboard-task';

export type WorkspaceMemberOption = {
  userId: number;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

type Props = {
  task: DashboardTask;
  members: WorkspaceMemberOption[];
  busy: boolean;
  onAdd: (userId: number) => Promise<void>;
  onRemove: (userId: number) => Promise<void>;
};

export function TaskAssigneeCell({ task, members, busy, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [actionKey, setActionKey] = useState<string | null>(null);

  const assignedIds = useMemo(
    () => new Set(task.assigneesDisplay?.map((a) => a.userId) ?? []),
    [task.assigneesDisplay],
  );

  const currentAssignees = task.assigneesDisplay ?? [];

  const pickableMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = members.filter((m) => !assignedIds.has(m.userId));
    if (!q) return pool;
    return pool.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        String(m.userId).includes(q),
    );
  }, [members, query, assignedIds]);

  const runAdd = async (userId: number) => {
    if (busy || actionKey) return;
    setActionKey(`add-${userId}`);
    try {
      await onAdd(userId);
    } finally {
      setActionKey(null);
    }
  };

  const runRemove = async (userId: number) => {
    if (busy || actionKey) return;
    setActionKey(`rm-${userId}`);
    try {
      await onRemove(userId);
    } finally {
      setActionKey(null);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className={cn(
            'flex min-w-0 max-w-full items-center justify-start rounded-md px-1 py-0.5 outline-none transition-[box-shadow,background-color]',
            'hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500/35',
            open && 'bg-slate-100 ring-2 ring-blue-200/80',
            busy && 'cursor-wait opacity-70',
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label="Edit assignees"
        >
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" aria-hidden />
          ) : (
            <AssigneeAvatarStack assignees={task.assigneesDisplay} avatarsOnly maxVisible={3} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,20rem)] p-0 shadow-lg"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-slate-100 p-2">
          <Input
            placeholder="Search or enter email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 text-sm"
            autoFocus
          />
        </div>

        <div className="max-h-[min(40vh,320px)] overflow-hidden">
          <div className="border-b border-slate-100 px-2 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Assignees</p>
            {currentAssignees.length === 0 ? (
              <p className="py-2 text-xs text-slate-500">No one assigned yet.</p>
            ) : (
              <ScrollArea className="max-h-[120px] pr-2">
                <ul className="space-y-1">
                  {currentAssignees.map((a) => {
                    const loading = actionKey === `rm-${a.userId}`;
                    return (
                      <li
                        key={a.userId}
                        className="flex items-center justify-between gap-2 rounded-md bg-slate-50/80 px-1.5 py-1"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <Avatar className="size-7 shrink-0 border border-white shadow-sm">
                            <AvatarImage src={a.avatarUrl ?? undefined} alt="" />
                            <AvatarFallback className="text-[10px]">{initials(a.displayName)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs font-medium text-slate-800">{a.displayName}</span>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(actionKey) || busy}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          aria-label={`Remove ${a.displayName}`}
                          onClick={() => void runRemove(a.userId)}
                        >
                          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </div>

          <div className="px-2 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">People</p>
            {pickableMembers.length === 0 ? (
              <p className="py-2 text-xs text-slate-500">
                {members.length === 0 ? 'No workspace members loaded.' : 'No matching people.'}
              </p>
            ) : (
              <ScrollArea className="max-h-[180px] pr-2">
                <ul className="space-0.5">
                  {pickableMembers.map((m) => {
                    const loading = actionKey === `add-${m.userId}`;
                    return (
                      <li key={m.userId}>
                        <button
                          type="button"
                          disabled={Boolean(actionKey) || busy}
                          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs hover:bg-slate-100 disabled:opacity-50"
                          onClick={() => void runAdd(m.userId)}
                        >
                          <Avatar className="size-7 shrink-0 border border-slate-100">
                            <AvatarImage src={m.avatarUrl ?? undefined} alt="" />
                            <AvatarFallback className="text-[10px]">{initials(m.displayName)}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{m.displayName}</span>
                          {loading ? <Loader2 className="size-3.5 shrink-0 animate-spin text-slate-400" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
