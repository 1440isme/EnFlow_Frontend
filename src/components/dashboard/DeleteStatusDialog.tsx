'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/http';
import { deleteStatus } from '@/lib/status-api';
import { formatStatusLabel } from '@/lib/task-status-ui';
import type { StatusesResponse } from '@/types/api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: StatusesResponse | null;
  onDeleted?: () => void | Promise<void>;
};

export default function DeleteStatusDialog({ open, onOpenChange, status, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);

    if (!status) {
      setError('Status not found.');
      return;
    }

    setDeleting(true);
    try {
      await deleteStatus(status.statusId);
      await onDeleted?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete status.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogDescription>
            Are you sure you want to delete '{status ? formatStatusLabel(status) : 'this status'}'? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            No
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? '...' : 'Yes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

