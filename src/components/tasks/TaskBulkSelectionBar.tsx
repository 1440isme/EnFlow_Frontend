'use client';

import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  deleting?: boolean;
};

export function TaskBulkSelectionBar({ count, onDelete, onClear, deleting }: Props) {
  if (count <= 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#0057b8]/20 bg-blue-50/90 px-3 py-2.5 text-sm shadow-sm">
      <span className="font-medium text-slate-800">
        {count} task{count === 1 ? '' : 's'} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="gap-1.5"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClear} disabled={deleting}>
          <X className="size-3.5" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  );
}
