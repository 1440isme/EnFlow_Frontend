'use client';

import { UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/components/ui/utils';
import type { TaskAssigneeDisplay } from '@/types/dashboard-task';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export type AssigneeAvatarStackProps = {
  assignees: TaskAssigneeDisplay[] | undefined;
  maxVisible?: number;
  className?: string;
  /** Chỉ vẽ avatar (không bọc button/tooltip) — dùng bên trong `TaskAssigneeCell` / PopoverTrigger. */
  avatarsOnly?: boolean;
};

export function AssigneeAvatarStack({
  assignees,
  maxVisible = 3,
  className,
  avatarsOnly = false,
}: AssigneeAvatarStackProps) {
  const list = assignees ?? [];
  if (list.length === 0) {
    return (
      <div
        className={cn('inline-flex items-center gap-1.5 text-slate-400', className)}
        title="Unassigned"
        onClick={(e) => e.stopPropagation()}
      >
        <UserPlus className="size-4 shrink-0" aria-hidden />
        <span className="text-[11px] font-medium">—</span>
      </div>
    );
  }

  const visible = list.slice(0, maxVisible);
  const overflow = list.length - visible.length;
  const tooltipText = list.map((a) => a.displayName).join(', ');

  const stack = (
    <div className="flex items-center pl-0.5">
      {visible.map((person, index) => (
        <Avatar
          key={person.userId}
          className={cn(
            'size-7 border-2 border-white bg-slate-100 text-[10px] font-semibold text-slate-700 shadow-sm',
            index > 0 && '-ml-2',
          )}
        >
          <AvatarImage src={person.avatarUrl ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="bg-slate-200 text-[10px] font-semibold text-slate-700">
            {initials(person.displayName)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            '-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold text-slate-700 shadow-sm',
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );

  if (avatarsOnly) {
    return (
      <div className={cn('inline-flex min-w-0', className)} aria-label={tooltipText}>
        {stack}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex min-w-0 cursor-default items-center border-0 bg-transparent p-0 text-left',
            className,
          )}
          aria-label={tooltipText}
          onClick={(e) => e.stopPropagation()}
        >
          {stack}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
