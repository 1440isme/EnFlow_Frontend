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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/http';
import { createStatus } from '@/lib/status-api';
import {
  getStatusGroupColor,
  getStatusGroupLabel,
  normalizeStatusGroup,
  STATUS_GROUP_OPTIONS,
  type StatusGroupValue,
} from '@/lib/status-groups';
import type { ProjectListResponse, StatusesResponse } from '@/types/api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  lists: ProjectListResponse[];
  existingStatuses: StatusesResponse[];
  onCreated?: () => void | Promise<void>;
};

export default function CreateStatusDialog({
  open,
  onOpenChange,
  projectId,
  lists,
  existingStatuses,
  onCreated,
}: Props) {
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<StatusGroupValue>('TO_DO');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedListStatuses = useMemo(
	() => existingStatuses.filter((status) => status.listId === selectedListId),
	[existingStatuses, selectedListId]
  );

  const usedGroups = useMemo(
	() => new Set(selectedListStatuses.map((status) => normalizeStatusGroup(status.statusGroup))),
	[selectedListStatuses]
  );

  const availableGroups = useMemo(
	() => STATUS_GROUP_OPTIONS.filter((option) => !usedGroups.has(option.value)),
	[usedGroups]
  );

  useEffect(() => {
	if (!open) return;

	setError(null);
	setSaving(false);

	const defaultListId = lists[0]?.listProjectId ?? null;
	setSelectedListId(defaultListId);
  }, [open, lists]);

  useEffect(() => {
	if (!open || selectedListId == null) return;

	const defaultGroup = availableGroups[0] ?? STATUS_GROUP_OPTIONS[0];
	setSelectedGroup(defaultGroup.value);
  }, [open, selectedListId, availableGroups]);


  const handleCreate = async () => {
	setError(null);

	if (!projectId) {
	  setError('Khong xac dinh duoc project hien tai.');
	  return;
	}

	if (selectedListId == null) {
	  setError('Hay chon list de tao status.');
	  return;
	}

	const nextPosition =
	  selectedListStatuses.reduce((max, status) => Math.max(max, Number(status.position) || 0), 0) + 1;

	setSaving(true);
	try {
	  await createStatus(projectId, selectedListId, {
		idProject: projectId,
		idListProject: selectedListId,
		color: getStatusGroupColor(selectedGroup),
		statusGroup: selectedGroup,
		position: nextPosition,
		isDefault: false,
	  });

	  await onCreated?.();
	  onOpenChange(false);
	} catch (e) {
	  setError(e instanceof ApiError ? e.message : 'Khong tao duoc status moi.');
	} finally {
	  setSaving(false);
	}
  };

  return (
	<Dialog open={open} onOpenChange={onOpenChange}>
	  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
		<DialogHeader>
		  <DialogTitle>Add group</DialogTitle>
		</DialogHeader>



		{error ? (
		  <Alert variant="destructive">
			<AlertDescription>{error}</AlertDescription>
		  </Alert>
		) : null}

		<div className="space-y-4 py-2">
		  <div className="space-y-2">
			<Label htmlFor="create-status-list">List</Label>
			<Select
			  value={selectedListId != null ? String(selectedListId) : ''}
			  onValueChange={(value) => setSelectedListId(Number(value))}
			  disabled={saving || lists.length === 0}
			>
			  <SelectTrigger id="create-status-list" className="bg-white">
				<SelectValue placeholder="Chon list" />
			  </SelectTrigger>
			  <SelectContent>
				{lists.map((list) => (
				  <SelectItem key={list.listProjectId} value={String(list.listProjectId)}>
					{list.name}
				  </SelectItem>
				))}
			  </SelectContent>
			</Select>
			{lists.length === 0 ? (
			  <p className="text-xs text-amber-600">
				Chua co list nao trong project. Hay tao list truoc khi them status.
			  </p>
			) : null}
		  </div>

		  <div className="space-y-2">
			<Label htmlFor="create-status-group">Status</Label>
			<Select
			  value={selectedGroup}
			  onValueChange={(value) => setSelectedGroup(value as StatusGroupValue)}
			  disabled={saving || availableGroups.length === 0}
			>
			  <SelectTrigger id="create-status-group" className="bg-white">
				<SelectValue placeholder="Chon enum status" />
			  </SelectTrigger>
			  <SelectContent>
				{STATUS_GROUP_OPTIONS.map((option) => {
				  const isUsed = usedGroups.has(option.value);
				  return (
					<SelectItem key={option.value} value={option.value} disabled={isUsed}>
					  {option.label}
					  {isUsed ? ' (da ton tai)' : ''}
					</SelectItem>
				  );
				})}
			  </SelectContent>
			</Select>
		  </div>
		</div>

		<DialogFooter>
		  <Button
			type="button"
			onClick={() => void handleCreate()}
			disabled={saving || lists.length === 0 || selectedListId == null || availableGroups.length === 0}
		  >
			{saving ? '...' : 'Create status'}
		  </Button>
		</DialogFooter>
	  </DialogContent>
	</Dialog>
  );
}

