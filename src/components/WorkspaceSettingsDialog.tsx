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
  canManageWorkspaceMembers,
  formatWorkspaceRole,
  isOwnerRole,
} from '@/lib/workspace-member-utils';
import { saveWorkspaceSnapshot, workspaceResponseToSnapshot } from '@/lib/workspace-storage';
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
  const [memberRole, setMemberRole] = useState<'admin' | 'member' | 'guest'>('member');
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
  const canManage = canManageWorkspaceMembers(myRoleKey);
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
          fullName: u?.fullName ?? `Người dùng #${m.userId}`,
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
      saveWorkspaceSnapshot(workspaceResponseToSnapshot(updated));
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không lưu được workspace.');
    } finally {
      setSaving(false);
    }
  };

  const handleLookupEmail = async () => {
    setLookupError(null);
    setMemberError(null);
    setMemberOk(null);
    setLookupResult(null);
    const email = memberEmail.trim();
    if (!email) {
      setLookupError('Nhập email.');
      return;
    }
    if (!email.includes('@')) {
      setLookupError('Email không hợp lệ.');
      return;
    }
    setLookupLoading(true);
    try {
      const found = await lookupUserByEmail(email);
      setLookupResult(found);
    } catch (e) {
      setLookupError(
        e instanceof ApiError ? e.message : 'Không tra cứu được người dùng.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAddMember = async () => {
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
        `Đã thêm ${lookupResult.fullName} (${lookupResult.email}) với vai trò ${memberRole}.`
      );
      setMemberEmail('');
      setLookupResult(null);
      setMemberRole('member');
      await loadMembers();
    } catch (e) {
      setMemberError(e instanceof ApiError ? e.message : 'Không thêm được thành viên.');
    } finally {
      setMemberSaving(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
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
      setMemberError(e instanceof ApiError ? e.message : 'Không cập nhật vai trò.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget || !hasServerId || snapshot.workspaceId == null) return;
    setRowBusy(removeTarget.userId);
    setMemberError(null);
    try {
      await removeWorkspaceMember(snapshot.workspaceId, removeTarget.userId);
      setRemoveTarget(null);
      await loadMembers();
    } catch (e) {
      setMemberError(e instanceof ApiError ? e.message : 'Không xóa được thành viên.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleDeleteWorkspace = async () => {
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
      setError(e instanceof ApiError ? e.message : 'Không xóa được workspace.');
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
            <DialogTitle>Cài đặt workspace</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {hasServerId
              ? 'Tên, mô tả và riêng tư được đồng bộ với máy chủ. Mã workspace chỉ đọc.'
              : 'Chưa có workspace trên server (chưa đăng nhập hoặc chưa đồng bộ). Lưu tạm trên trình duyệt.'}
          </p>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Tên workspace</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-input-background"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-key">Mã workspace (workspace_key)</Label>
              <Input
                id="ws-key"
                value={workspaceKey}
                onChange={(e) => setWorkspaceKey(e.target.value)}
                className="bg-input-background font-mono text-sm"
                placeholder="my-workspace"
                readOnly={hasServerId}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-desc">Mô tả</Label>
              <Textarea
                id="ws-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="bg-input-background"
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div>
                <p className="font-medium text-gray-900">Workspace riêng tư</p>
                <p className="text-sm text-gray-600">Tương ứng is_private trên server</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} disabled={saving} />
            </div>

            {hasServerId ? (
              <>
                <Separator className="my-2" />
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">Thành viên</p>
                  {membersLoading ? (
                    <p className="text-sm text-gray-500">Đang tải danh sách…</p>
                  ) : memberRows.length === 0 ? (
                    <p className="text-sm text-gray-500">Chưa có thành viên.</p>
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
                                    <span className="ml-2 text-xs font-normal text-[#004ba8]">(Bạn)</span>
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
                                      <SelectItem value="admin">Admin</SelectItem>
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
                                    Gỡ
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

                <Separator className="my-2" />
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-900">Thêm thành viên</p>
                    <p className="text-sm text-gray-600">
                      Tra cứu theo email, xác nhận rồi chọn vai trò.
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
                      <Label htmlFor="ws-member-email">Email người được mời</Label>
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
                      {lookupLoading ? 'Đang tra…' : 'Tra cứu'}
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
                        Xác nhận người được mời
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
                          <Label>Vai trò</Label>
                          <Select
                            value={memberRole}
                            onValueChange={(v) =>
                              setMemberRole(v as 'admin' | 'member' | 'guest')
                            }
                            disabled={memberSaving}
                          >
                            <SelectTrigger className="bg-input-background w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
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
                          {memberSaving ? 'Đang thêm…' : 'Thêm vào workspace'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {isWorkspaceOwner ? (
                  <>
                    <Separator className="my-2" />
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                      <p className="font-medium text-red-900">Vùng nguy hiểm</p>
                      <p className="mt-1 text-sm text-red-800/90">
                        Xóa vĩnh viễn workspace này. Thao tác không hoàn tác.
                      </p>
                      <Button
                        type="button"
                        variant="destructive"
                        className="mt-3"
                        onClick={() => setDeleteWsOpen(true)}
                        disabled={saving || deleteWsLoading}
                      >
                        Xóa workspace
                      </Button>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Hủy
            </Button>
            <Button
              type="button"
              className="bg-[#004ba8] hover:bg-[#003d8a]"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeTarget != null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ thành viên?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `Người dùng ${removeTarget.fullName} (${removeTarget.email}) sẽ bị gỡ khỏi workspace.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleConfirmRemove()}
            >
              Gỡ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteWsOpen} onOpenChange={setDeleteWsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ dữ liệu workspace trên máy chủ có thể bị ảnh hưởng. Bạn sẽ được chuyển sang workspace
              khác nếu còn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWsLoading}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteWorkspace();
              }}
              disabled={deleteWsLoading}
            >
              {deleteWsLoading ? 'Đang xóa…' : 'Xóa workspace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
