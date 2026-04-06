import { useEffect, useMemo, useState } from 'react';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';

export type WorkspaceRoleState = {
  workspaceId: number | null;
  roleInWorkspace: string;
  roleLoaded: boolean;
  canEdit: boolean;
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
    const canEdit = roleLoaded && roleKey !== '' && roleKey !== 'guest';
    return {
      workspaceId: snap.workspaceId ?? null,
      roleInWorkspace: roleKey,
      roleLoaded,
      canEdit,
    };
  }, [snap.roleInWorkspace, snap.workspaceId]);
}

