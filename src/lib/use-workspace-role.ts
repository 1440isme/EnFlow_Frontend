import { useEffect, useMemo, useState } from 'react';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';

export type WorkspaceRoleState = {
  workspaceId: number | null;
  roleInWorkspace: string;
  roleLoaded: boolean;
  canEdit: boolean;
  isOwner: boolean;
  isMember: boolean;
  isGuest: boolean;
  canManageWorkspace: boolean;
  canManageProjectStructure: boolean;
  canCreateTask: boolean;
  canManageTaskAssignments: boolean;
};

export function useWorkspaceRole(): WorkspaceRoleState {
  const [snap, setSnap] = useState(() => getWorkspaceSnapshot());

  useEffect(() => {
    const sync = () => setSnap(getWorkspaceSnapshot());
    sync();
    window.addEventListener('enflow-workspace-changed', sync);
    return () => window.removeEventListener('enflow-workspace-changed', sync);
  }, []);

  return useMemo(() => {
    const roleKey = String(snap.roleInWorkspace ?? '').trim().toLowerCase();
    const roleLoaded = snap.workspaceId == null ? true : roleKey.length > 0;
    const isOwner = roleLoaded && roleKey === 'owner';
    const isMember = roleLoaded && roleKey === 'member';
    const isGuest = roleLoaded && roleKey === 'guest';
    const canEdit = roleLoaded && roleKey !== '' && roleKey !== 'guest';
    return {
      workspaceId: snap.workspaceId ?? null,
      roleInWorkspace: roleKey,
      roleLoaded,
      canEdit,
      isOwner,
      isMember,
      isGuest,
      canManageWorkspace: isOwner,
      canManageProjectStructure: isOwner,
      canCreateTask: isOwner,
      canManageTaskAssignments: isOwner,
    };
  }, [snap.roleInWorkspace, snap.workspaceId]);
}

