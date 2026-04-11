'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/http';
import { updateList } from '@/lib/list-api';
import type { ProjectListResponse } from '@/types/api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: ProjectListResponse | null;
  onUpdated?: () => void | Promise<void>;
};

export default function RenameListDialog({
  open,
  onOpenChange,
  list,
  onUpdated,
}: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !list) {
      setName('');
      setError(null);
      return;
    }

    setName(list.name);
    setError(null);
  }, [open, list]);

  const handleRename = async () => {
    setError(null);

    if (!list) {
      setError('List not found.');
      return;
    }

    const currentList = list;

    if (!name.trim()) {
      setError('The list name cannot be blank.');
      return;
    }

    if (name.trim() === currentList.name) {
      // No changes
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      await updateList(currentList.listProjectId, {
        name: name.trim(),
        description: currentList.description,
        position: currentList.position,
        archived: currentList.archived,
        isPrivate: currentList.isPrivate,
      });

      await onUpdated?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not rename list.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-list-name">Name</Label>
            <Input
              id="rename-list-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white"
              disabled={saving}
              placeholder="Enter a new list name."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !saving) {
                  void handleRename();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={() => void handleRename()}
            disabled={saving || !name.trim()}
          >
            {saving ? '...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
