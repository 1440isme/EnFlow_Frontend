'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { X } from 'lucide-react';
import { ApiError } from '@/lib/http';
import { getStoredUserId } from '@/lib/auth-session';
import { lookupUserByEmail } from '@/lib/user-api';
import { profileInitials } from '@/lib/user-profile';
import { addWorkspaceMember, createWorkspace } from '@/lib/workspace-api';
import { saveWorkspaceSnapshot, workspaceResponseToSnapshot } from '@/lib/workspace-storage';
import type { UserPublicLookupResponse } from '@/types/api';

type PendingInvite = {
  userId: number;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: 'member' | 'guest';
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

export default function CreateWorkspaceDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('');
  const [workspaceKey, setWorkspaceKey] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLookup, setInviteLookup] = useState<UserPublicLookupResponse | null>(null);
  const [inviteLookupLoading, setInviteLookupLoading] = useState(false);
  const [inviteLookupError, setInviteLookupError] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<'member' | 'guest'>('member');
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteListError, setInviteListError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setWorkspaceKey('');
      setDescription('');
      setIsPrivate(false);
      setError(null);
      setInviteEmail('');
      setInviteLookup(null);
      setInviteLookupError(null);
      setInviteRole('member');
      setPendingInvites([]);
      setInviteListError(null);
    }
  }, [open]);

  const handleInviteLookup = async () => {
    setInviteLookupError(null);
    setInviteListError(null);
    setInviteLookup(null);
    const email = inviteEmail.trim();
    if (!email) {
      setInviteLookupError('Enter an email address.');
      return;
    }
    if (!email.includes('@')) {
      setInviteLookupError('Invalid email.');
      return;
    }
    setInviteLookupLoading(true);
    try {
      const found = await lookupUserByEmail(email);
      setInviteLookup(found);
    } catch (e) {
      setInviteLookupError(
        e instanceof ApiError ? e.message : 'User lookup failed.'
      );
    } finally {
      setInviteLookupLoading(false);
    }
  };

  const handleAddToPendingList = () => {
    if (!inviteLookup) return;
    setInviteListError(null);
    const norm = inviteLookup.email.trim().toLowerCase();
    if (pendingInvites.some((p) => p.email.toLowerCase() === norm)) {
      setInviteListError('This email is already on the invite list.');
      return;
    }
    setPendingInvites((prev) => [
      ...prev,
      {
        userId: inviteLookup.userId,
        fullName: inviteLookup.fullName,
        email: inviteLookup.email,
        avatarUrl: inviteLookup.avatarUrl,
        role: inviteRole,
      },
    ]);
    setInviteEmail('');
    setInviteLookup(null);
    setInviteRole('member');
  };

  const removePending = (email: string) => {
    setPendingInvites((prev) => prev.filter((p) => p.email !== email));
  };

  const handleCreate = async () => {
    setError(null);
    const ownerUserId = getStoredUserId();
    if (ownerUserId == null) {
      setError('Sign in to create a workspace.');
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a workspace name.');
      return;
    }
    const keyRaw = workspaceKey.trim().replace(/\s+/g, '-').toLowerCase();
    setSaving(true);
    try {
      const created = await createWorkspace({
        name: trimmedName,
        workspaceKey: keyRaw.length > 0 ? keyRaw : null,
        description: description.trim(),
        ownerUserId,
        isPrivate,
      });

      for (const p of pendingInvites) {
        await addWorkspaceMember(created.workspaceId, {
          userId: p.userId,
          roleInWorkspace: p.role,
        });
      }

      saveWorkspaceSnapshot(workspaceResponseToSnapshot(created));
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create workspace or add members.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          You will be the owner. Optionally look up users by email and add them—they are invited when the workspace is created.
        </p>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cw-name">Workspace name</Label>
            <Input
              id="cw-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-input-background"
              disabled={saving}
              placeholder="e.g. Marketing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cw-key">Workspace key</Label>
            <Input
              id="cw-key"
              value={workspaceKey}
              onChange={(e) => setWorkspaceKey(e.target.value)}
              className="bg-input-background font-mono text-sm"
              disabled={saving}
              placeholder="short-key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cw-desc">Description</Label>
            <Textarea
              id="cw-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-input-background"
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <p className="font-medium text-gray-900">Private workspace</p>
              <p className="text-sm text-gray-600">Only invited members can access</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} disabled={saving} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="font-medium text-gray-900">Invite members</p>
              <p className="text-sm text-gray-600">
                Look up by email, confirm the profile, then add to the list. You can invite multiple people before creating the workspace.
              </p>
            </div>
            {inviteListError ? (
              <Alert variant="destructive">
                <AlertDescription>{inviteListError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-2 flex-1 min-w-0">
                <Label htmlFor="cw-invite-email">Email</Label>
                <Input
                  id="cw-invite-email"
                  type="email"
                  autoComplete="off"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteLookup(null);
                    setInviteLookupError(null);
                  }}
                  className="bg-input-background"
                  placeholder="user@example.com"
                  disabled={saving || inviteLookupLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleInviteLookup();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => void handleInviteLookup()}
                disabled={saving || inviteLookupLoading}
              >
                {inviteLookupLoading ? 'Looking up…' : 'Look up'}
              </Button>
            </div>
            {inviteLookupError ? (
              <Alert variant="destructive">
                <AlertDescription>{inviteLookupError}</AlertDescription>
              </Alert>
            ) : null}
            {inviteLookup ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Invite
                </p>
                <div className="flex gap-3 items-center">
                  {inviteLookup.avatarUrl ? (
                    <img
                      src={inviteLookup.avatarUrl}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#004ba8] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                      {profileInitials({
                        fullName: inviteLookup.fullName,
                        email: inviteLookup.email,
                      })}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{inviteLookup.fullName}</p>
                    <p className="text-sm text-gray-600 truncate">{inviteLookup.email}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="space-y-2 sm:w-40">
                    <Label>Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) =>
                        setInviteRole(v as 'member' | 'guest')
                      }
                      disabled={saving}
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
                    variant="outline"
                    className="sm:ml-auto"
                    onClick={handleAddToPendingList}
                    disabled={saving}
                  >
                    Add to list
                  </Button>
                </div>
              </div>
            ) : null}

            {pendingInvites.length > 0 ? (
              <ul className="space-y-2">
                {pendingInvites.map((p) => (
                  <li
                    key={p.email}
                    className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-gray-900">{p.fullName}</span>
                      <span className="text-gray-500"> · {p.email}</span>
                      <span className="text-gray-400"> · {p.role}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-gray-500"
                      onClick={() => removePending(p.email)}
                      disabled={saving}
                      aria-label="Remove from list"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#004ba8] hover:bg-[#003d8a]"
            onClick={() => void handleCreate()}
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
