'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/http';
import { createList } from '@/lib/list-api';
import type { ProjectListResponse } from '@/types/api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  lists: ProjectListResponse[];
  onCreated?: () => void | Promise<void>;
};

export default function CreateListDialog({
  open,
  onOpenChange,
  projectId,
  lists,
  onCreated,
}: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPosition = useMemo(
    () => lists.reduce((max, list) => Math.max(max, Number(list.position) || 0), 0) + 1,
    [lists]
  );

  const isProjectIdValid = Number.isFinite(projectId) && projectId > 0;

  useEffect(() => {
    if (!open) return;

    setError(null);
    setSaving(false);
    setName('');
    setDescription('');
  }, [open]);

  const handleCreate = async () => {
    setError(null);

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!isProjectIdValid) {
      setError('Không xác định được project hiện tại.');
      return;
    }

    if (!trimmedName) {
      setError('Please enter the list name.');
      return;
    }

    setSaving(true);
    try {
      await createList(projectId, {
        projectId,
        name: trimmedName,
        description: trimmedDescription,
        position: nextPosition,
        isPrivate: true,
        archived: false,
      });

      await onCreated?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create a new list.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create List</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">
            All Lists are located within a Space. Lists can house any type of task.
        </p>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="create-list-name">Name</Label>
            <Input
              id="create-list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project, List of items, Campaign"
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving || !isProjectIdValid}
          >
            {saving ? '...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
