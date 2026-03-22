'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Mail } from 'lucide-react';
import { ApiError } from '@/lib/http';
import { getCurrentUser, getUserById } from '@/lib/user-api';
import {
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMember,
} from '@/lib/workspace-api';
import {
  canManageWorkspaceMembers,
  formatWorkspaceRole,
  isOwnerRole,
} from '@/lib/workspace-member-utils';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';
import { profileInitials } from '@/lib/user-profile';
import type { UserResponse, WorkspaceMemberResponse } from '@/types/api';

type DisplayMember = {
  userId: number;
  fullName: string;
  email: string;
  roleKey: string;
  roleInWorkspace: string;
  avatarUrl: string | null;
  isYou: boolean;
};

async function resolveUser(
  userId: number,
  me: UserResponse,
  cache: Map<number, UserResponse>
): Promise<UserResponse | null> {
  if (userId === me.userId) return me;
  const hit = cache.get(userId);
  if (hit) return hit;
  try {
    const u = await getUserById(userId);
    cache.set(userId, u);
    return u;
  } catch {
    return null;
  }
}

export default function TeamPage() {
  const [rows, setRows] = useState<DisplayMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myRoleKey, setMyRoleKey] = useState<string>('member');
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<DisplayMember | null>(null);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);

  const canManage = canManageWorkspaceMembers(myRoleKey);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const snapshot = getWorkspaceSnapshot();
      const me = await getCurrentUser();

      if (!snapshot.workspaceId) {
        setWorkspaceId(null);
        setMyRoleKey('member');
        setRows([
          {
            userId: me.userId,
            fullName: me.fullName,
            email: me.email,
            roleKey: '—',
            roleInWorkspace: '—',
            avatarUrl: me.avatarUrl,
            isYou: true,
          },
        ]);
        return;
      }

      setWorkspaceId(snapshot.workspaceId);

      let members: WorkspaceMemberResponse[] = [];
      try {
        members = await listWorkspaceMembers(snapshot.workspaceId);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          throw e;
        }
        setError(
          e instanceof ApiError
            ? e.message
            : 'Không tải được danh sách thành viên. Hiển thị tối thiểu tài khoản của bạn.'
        );
      }

      let roleMine =
        members.find((m) => m.userId === me.userId)?.roleInWorkspace ?? 'member';
      if (snapshot.ownerUserId === me.userId) {
        roleMine = 'owner';
      }
      setMyRoleKey(roleMine);

      const memberByUserId = new Map(members.map((m) => [m.userId, m]));
      const userIds = new Set(members.map((m) => m.userId));

      if (!userIds.has(me.userId)) {
        userIds.add(me.userId);
        const syntheticRole =
          snapshot.ownerUserId != null && snapshot.ownerUserId === me.userId
            ? 'owner'
            : 'member';
        memberByUserId.set(me.userId, {
          workspaceId: snapshot.workspaceId,
          userId: me.userId,
          roleInWorkspace: syntheticRole,
          isActive: true,
        });
      }

      const cache = new Map<number, UserResponse>();
      cache.set(me.userId, me);

      const display: DisplayMember[] = [];
      for (const userId of userIds) {
        const mem = memberByUserId.get(userId);
        const u = await resolveUser(userId, me, cache);
        const roleRaw = mem?.roleInWorkspace ?? 'member';
        if (u) {
          display.push({
            userId: u.userId,
            fullName: u.fullName,
            email: u.email,
            roleKey: roleRaw,
            roleInWorkspace: formatWorkspaceRole(roleRaw),
            avatarUrl: u.avatarUrl,
            isYou: u.userId === me.userId,
          });
        } else {
          display.push({
            userId,
            fullName: `Người dùng #${userId}`,
            email: '—',
            roleKey: roleRaw,
            roleInWorkspace: formatWorkspaceRole(roleRaw),
            avatarUrl: null,
            isYou: userId === me.userId,
          });
        }
      }

      display.sort((a, b) => {
        if (a.isYou && !b.isYou) return -1;
        if (!a.isYou && b.isYou) return 1;
        return a.fullName.localeCompare(b.fullName, 'vi');
      });

      setRows(display);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        setRows([]);
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Không tải được team.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onWs = () => void load();
    window.addEventListener('enflow-workspace-changed', onWs);
    return () => window.removeEventListener('enflow-workspace-changed', onWs);
  }, [load]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (workspaceId == null) return;
    setRowBusy(userId);
    setActionError(null);
    try {
      await updateWorkspaceMember(workspaceId, userId, {
        roleInWorkspace: newRole,
        isActive: true,
      });
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Không cập nhật vai trò.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget || workspaceId == null) return;
    setRowBusy(removeTarget.userId);
    setActionError(null);
    try {
      await removeWorkspaceMember(workspaceId, removeTarget.userId);
      setRemoveTarget(null);
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Không gỡ được thành viên.');
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Team</h1>
        <p className="text-gray-600">
          Thành viên workspace hiện tại. Chủ sở hữu / Admin có thể đổi vai trò hoặc gỡ thành viên (trừ
          chủ sở hữu).
        </p>
      </div>

      {error ? (
        <Card className="p-4 border-amber-200 bg-amber-50/80 text-amber-900 text-sm">{error}</Card>
      ) : null}
      {actionError ? (
        <Card className="p-4 border-red-200 bg-red-50/80 text-red-900 text-sm">{actionError}</Card>
      ) : null}

      {loading ? (
        <Card className="p-12 text-center text-gray-600">Đang tải danh sách…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-gray-600">Không có dữ liệu thành viên.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rows.map((member) => {
            const initials = profileInitials({
              fullName: member.fullName,
              email: member.email,
            });
            const busy = rowBusy === member.userId;
            const isOwner = isOwnerRole(member.roleKey);
            const showActions = canManage && workspaceId != null && !isOwner;
            return (
              <Card key={member.userId} className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt=""
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-[#004ba8] flex items-center justify-center text-white font-medium">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{member.fullName}</h3>
                        {member.isYou ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Bạn</Badge>
                        ) : null}
                      </div>
                      {showActions ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Select
                            value={member.roleKey}
                            onValueChange={(v) => void handleRoleChange(member.userId, v)}
                            disabled={busy}
                          >
                            <SelectTrigger className="h-9 w-[140px] bg-input-background">
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
                            className="text-red-600 border-red-200"
                            disabled={busy}
                            onClick={() => setRemoveTarget(member)}
                          >
                            Gỡ
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">{member.roleInWorkspace}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={removeTarget != null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ thành viên?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${removeTarget.fullName} (${removeTarget.email}) sẽ bị gỡ khỏi workspace.`
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
    </div>
  );
}
