'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceSnapshot } from '@/types/workspace';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/http';
import { getStoredUserId, syncWorkspaceFromApi } from '@/lib/auth-session';
import { getCurrentUser, getUserById, lookupUserByEmail } from '@/lib/user-api';
import { profileInitials } from '@/lib/user-profile';
import {
  addWorkspaceMember,
  deleteWorkspace,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMember,
} from '@/lib/workspace-api';
import {
  canManageTeamMembers,
  formatWorkspaceRole,
  isOwnerRole,
} from '@/lib/workspace-member-utils';
import { getWorkspaceSnapshot, saveWorkspaceSnapshot, workspaceResponseToSnapshot } from '@/lib/workspace-storage';
import { hydrateWorkspaceRoleInSnapshot } from '@/lib/workspace-role';
import type { UserPublicLookupResponse } from '@/types/api';

type MemberRow = {
  userId: number;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  roleKey: string;
  isActive: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: WorkspaceSnapshot;
  onSaved?: () => void;
};

export default function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  snapshot,
  onSaved,
}: Props) {
  const [name, setName] = useState(snapshot.name);
  const [workspaceKey, setWorkspaceKey] = useState(snapshot.workspaceKey);
  const [description, setDescription] = useState(snapshot.description);
  const [isPrivate, setIsPrivate] = useState(snapshot.isPrivate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [memberEmail, setMemberEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<UserPublicLookupResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<'member' | 'guest'>('member');
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberOk, setMemberOk] = useState<string | null>(null);

  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myRoleKey, setMyRoleKey] = useState<string>('member');
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [deleteWsOpen, setDeleteWsOpen] = useState(false);
  const [deleteWsLoading, setDeleteWsLoading] = useState(false);

  const hasServerId = snapshot.workspaceId != null;
  const canManage = canManageTeamMembers(myRoleKey);
  const canEditWorkspace = myRoleKey.trim().toLowerCase() === 'owner';
  const isWorkspaceOwner =
    snapshot.ownerUserId != null &&
    myUserId != null &&
    snapshot.ownerUserId === myUserId;

  const loadMembers = useCallback(async () => {
    if (snapshot.workspaceId == null) return;
    setMembersLoading(true);
    try {
      const me = await getCurrentUser();
      setMyUserId(me.userId);
      const members = await listWorkspaceMembers(snapshot.workspaceId);
      let roleMine =
        members.find((m) => m.userId === me.userId)?.roleInWorkspace ?? 'member';
      if (snapshot.ownerUserId === me.userId) {
        roleMine = 'owner';
      }
      setMyRoleKey(roleMine);

      const rows: MemberRow[] = [];
      for (const m of members) {
        let u;
        try {
          u = await getUserById(m.userId);
        } catch {
          u = null;
        }
        rows.push({
          userId: m.userId,
          fullName: u?.fullName ?? `User #${m.userId}`,
          email: u?.email ?? '—',
          avatarUrl: u?.avatarUrl ?? null,
          roleKey: m.roleInWorkspace,
          isActive: m.isActive,
        });
      }
      setMemberRows(rows);
    } catch {
      setMemberRows([]);
    } finally {
      setMembersLoading(false);
    }
  }, [snapshot.workspaceId, snapshot.ownerUserId]);

  useEffect(() => {
    if (open) {
      setName(snapshot.name);
      setWorkspaceKey(snapshot.workspaceKey);
      setDescription(snapshot.description);
      setIsPrivate(snapshot.isPrivate);
      setError(null);
      setMemberEmail('');
      setLookupResult(null);
      setLookupError(null);
      setMemberRole('member');
      setMemberError(null);
      setMemberOk(null);
      setRemoveTarget(null);
      setDeleteWsOpen(false);
    }
  }, [open, snapshot]);

  useEffect(() => {
    if (open && hasServerId) {
      void loadMembers();
    }
  }, [open, hasServerId, loadMembers]);

  const handleSave = async () => {
    if (!canEditWorkspace) {
      setError('Chỉ owner mới được chỉnh workspace.');
      return;
    }
    setError(null);
    const trimmedName = name.trim() || snapshot.name;
    const trimmedDesc = description.trim();

    if (!hasServerId) {
      const next: WorkspaceSnapshot = {
        workspaceId: snapshot.workspaceId,
        ownerUserId: snapshot.ownerUserId ?? null,
        name: trimmedName,
        workspaceKey:
          workspaceKey.trim().replace(/\s+/g, '-').toLowerCase() || snapshot.workspaceKey,
        description: trimmedDesc,
        isPrivate,
      };
      saveWorkspaceSnapshot(next);
      onSaved?.();
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateWorkspace(snapshot.workspaceId!, {
        name: trimmedName,
        description: trimmedDesc,
        isPrivate,
      });
      const cur = getWorkspaceSnapshot();
      saveWorkspaceSnapshot(
        workspaceResponseToSnapshot(
          updated,
          cur.workspaceId === updated.workspaceId ? cur.roleInWorkspace ?? '' : '',
        ),
      );
      void hydrateWorkspaceRoleInSnapshot(updated.workspaceId);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save workspace.');
    } finally {
      setSaving(false);
    }
  };

  const handleLookupEmail = async () => {
    if (!canEditWorkspace) return;
    setLookupError(null);
    setMemberError(null);
    setMemberOk(null);
    setLookupResult(null);
    const email = memberEmail.trim();
    if (!email) {
      setLookupError('Enter an email address.');
      return;
    }
    if (!email.includes('@')) {
      setLookupError('Invalid email.');
      return;
    }
    setLookupLoading(true);
    try {
      const found = await lookupUserByEmail(email);
      setLookupResult(found);
    } catch (e) {
      setLookupError(
        e instanceof ApiError ? e.message : 'User lookup failed.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!canEditWorkspace) return;
    if (!hasServerId || snapshot.workspaceId == null || lookupResult == null) return;
    setMemberError(null);
    setMemberOk(null);
    setMemberSaving(true);
    try {
      await addWorkspaceMember(snapshot.workspaceId, {
        userId: lookupResult.userId,
        roleInWorkspace: memberRole,
      });
      setMemberOk(
        `Added ${lookupResult.fullName} (${lookupResult.email}) as ${memberRole}.`
      );
      setMemberEmail('');
      setLookupResult(null);
      setMemberRole('member');
      await loadMembers();
    } catch (e) {
      setMemberError(e instanceof ApiError ? e.message : 'Could not add member.');
    } finally {
      setMemberSaving(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (!canEditWorkspace) return;
    if (!hasServerId || snapshot.workspaceId == null) return;
    setRowBusy(userId);
    setMemberError(null);
    try {
      await updateWorkspaceMember(snapshot.workspaceId, userId, {
        roleInWorkspace: newRole,
        isActive: true,
      });
      await loadMembers();
    } catch (e) {
      setMemberError(e instanceof ApiError ? e.message : 'Could not update role.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!canEditWorkspace) return;
    if (!removeTarget || !hasServerId || snapshot.workspaceId == null) return;
    setRowBusy(removeTarget.userId);
    setMemberError(null);
    try {
      await removeWorkspaceMember(snapshot.workspaceId, removeTarget.userId);
      setRemoveTarget(null);
      await loadMembers();
    } catch (e) {
      setMemberError(e instanceof ApiError ? e.message : 'Could not remove member.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!canEditWorkspace) {
      setError('Chỉ owner mới được chỉnh workspace.');
      return;
    }
    if (!hasServerId || snapshot.workspaceId == null) return;
    setDeleteWsLoading(true);
    try {
      await deleteWorkspace(snapshot.workspaceId);
      onOpenChange(false);
      const uid = getStoredUserId();
      if (uid != null) {
        await syncWorkspaceFromApi(uid);
      }
      onSaved?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete workspace.');
    } finally {
      setDeleteWsLoading(false);
      setDeleteWsOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workspace settings</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {hasServerId
              ? 'Name, description, and privacy sync to the server. Workspace key is read-only.'
              : 'No workspace on the server yet. Changes are saved locally in your browser.'}
          </p>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-input-background"
                disabled={!canEditWorkspace || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-key">Workspace key</Label>
              <Input
                id="ws-key"
                value={workspaceKey}
                onChange={(e) => setWorkspaceKey(e.target.value)}
                className="bg-input-background font-mono text-sm"
                placeholder="my-workspace"
                readOnly={hasServerId}
                disabled={!canEditWorkspace || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-desc">Description</Label>
              <Textarea
                id="ws-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="bg-input-background"
                disabled={!canEditWorkspace || saving}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div>
                <p className="font-medium text-gray-900">Private workspace</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} disabled={!canEditWorkspace || saving} />
            </div>

            {hasServerId ? (
              <>
                <Separator className="my-2" />
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">Members</p>
                  {membersLoading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                  ) : memberRows.length === 0 ? (
                    <p className="text-sm text-gray-500">No members yet.</p>
                  ) : (
                    <ul className="space-y-2 max-h-52 overflow-y-auto">
                      {memberRows.map((row) => {
                        const busy = rowBusy === row.userId;
                        const isOwner = isOwnerRole(row.roleKey);
                        const isMe = myUserId === row.userId;
                        const showActions = canManage && !isOwner;
                        return (
                          <li
                            key={row.userId}
                            className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              {row.avatarUrl ? (
                                <img
                                  src={row.avatarUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#004ba8] text-sm font-semibold text-white">
                                  {profileInitials({
                                    fullName: row.fullName,
                                    email: row.email,
                                  })}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900">
                                  {row.fullName}
                                  {isMe ? (
                                    <span className="ml-2 text-xs font-normal text-[#004ba8]">You</span>
                                  ) : null}
                                </p>
                                <p className="truncate text-xs text-gray-600">{row.email}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {isOwner ? (
                                <span className="text-sm text-gray-700">
                                  {formatWorkspaceRole(row.roleKey)}
                                </span>
                              ) : showActions ? (
                                <>
                                  <Select
                                    value={row.roleKey}
                                    onValueChange={(v) => void handleRoleChange(row.userId, v)}
                                    disabled={busy}
                                  >
                                    <SelectTrigger className="h-9 w-[130px] bg-input-background">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="member">Member</SelectItem>
                                      <SelectItem value="guest">Guest</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    disabled={busy}
                                    onClick={() => setRemoveTarget(row)}
                                  >
                                    Remove
                                  </Button>
                                </>
                              ) : (
                                <span className="text-sm text-gray-700">
                                  {formatWorkspaceRole(row.roleKey)}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {canManage ? (
                  <>
                    <Separator className="my-2" />
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-gray-900">Add member</p>
                        <p className="text-sm text-gray-600">
                          Look up by email, confirm, then choose Member or Guest.
                        </p>
                      </div>
                      {memberOk ? (
                        <Alert>
                          <AlertDescription>{memberOk}</AlertDescription>
                        </Alert>
                      ) : null}
                      {memberError ? (
                        <Alert variant="destructive">
                          <AlertDescription>{memberError}</AlertDescription>
                        </Alert>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Label htmlFor="ws-member-email">Invitee email</Label>
                          <Input
                            id="ws-member-email"
                            type="email"
                            autoComplete="off"
                            value={memberEmail}
                            onChange={(e) => {
                              setMemberEmail(e.target.value);
                              setLookupResult(null);
                              setLookupError(null);
                            }}
                            className="bg-input-background"
                            placeholder="user@example.com"
                            disabled={memberSaving || lookupLoading}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleLookupEmail();
                              }
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="shrink-0"
                          onClick={() => void handleLookupEmail()}
                          disabled={memberSaving || lookupLoading}
                        >
                          {lookupLoading ? 'Looking up…' : 'Look up'}
                        </Button>
                      </div>
                      {lookupError ? (
                        <Alert variant="destructive">
                          <AlertDescription>{lookupError}</AlertDescription>
                        </Alert>
                      ) : null}
                      {lookupResult ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                            Confirm invite
                          </p>
                          <div className="flex items-center gap-4">
                            {lookupResult.avatarUrl ? (
                              <img
                                src={lookupResult.avatarUrl}
                                alt=""
                                className="h-14 w-14 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#004ba8] font-semibold text-white">
                                {profileInitials({
                                  fullName: lookupResult.fullName,
                                  email: lookupResult.email,
                                })}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-gray-900">{lookupResult.fullName}</p>
                              <p className="truncate text-sm text-gray-600">{lookupResult.email}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="space-y-2 sm:w-44">
                              <Label>Role</Label>
                              <Select
                                value={memberRole}
                                onValueChange={(v) =>
                                  setMemberRole(v as 'member' | 'guest')
                                }
                                disabled={memberSaving}
                              >
                                <SelectTrigger className="bg-input-background w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="guest">Guest</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              className="w-full bg-[#004ba8] hover:bg-[#003d8a] sm:w-auto"
                              onClick={() => void handleAddMember()}
                              disabled={memberSaving || lookupLoading}
                            >
                              {memberSaving ? 'Adding…' : 'Add to workspace'}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {isWorkspaceOwner ? (
                  <>
                    <Separator className="my-2" />
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                      <p className="font-medium text-red-900">Danger zone</p>
                      <p className="mt-1 text-sm text-red-800/90">
                        Permanently delete this workspace. This cannot be undone.
                      </p>
                      <Button
                        type="button"
                        variant="destructive"
                        className="mt-3"
                        onClick={() => setDeleteWsOpen(true)}
                        disabled={!canEditWorkspace || saving || deleteWsLoading}
                      >
                        Delete workspace
                      </Button>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#004ba8] hover:bg-[#003d8a]"
              onClick={() => void handleSave()}
              disabled={!canEditWorkspace || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeTarget != null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${removeTarget.fullName} (${removeTarget.email}) will be removed from this workspace.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleConfirmRemove()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteWsOpen} onOpenChange={setDeleteWsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              All data for this workspace on the server may be removed. If you have another workspace, you will switch to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWsLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteWorkspace();
              }}
              disabled={deleteWsLoading}
            >
              {deleteWsLoading ? 'Deleting…' : 'Delete workspace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
