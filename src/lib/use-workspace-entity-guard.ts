import { useEffect } from 'react';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';

type GuardOptions = {
  /** WorkspaceId mà entity thuộc về (nếu đã biết). */
  entityWorkspaceId: number | null;
  /** Fallback: nếu chưa biết entityWorkspaceId thì fetch để xác minh. */
  fetchEntityWorkspaceId?: () => Promise<number | null>;
  /** Điều hướng khi mismatch / lỗi xác minh. */
  onMismatch: () => void;
};

/**
 * Guard toàn cục cho các trang "entity detail" (task / project / ...):
 * Khi user switch workspace, nếu entity không thuộc workspace đang chọn thì redirect ra trang an toàn.
 */
export function useWorkspaceEntityGuard({
  entityWorkspaceId,
  fetchEntityWorkspaceId,
  onMismatch,
}: GuardOptions): void {
  useEffect(() => {
    let alive = true;

    const verify = async () => {
      const snapWs = getWorkspaceSnapshot().workspaceId;
      if (snapWs == null) return;

      if (entityWorkspaceId != null) {
        if (entityWorkspaceId !== snapWs) onMismatch();
        return;
      }

      if (!fetchEntityWorkspaceId) return;
      try {
        const ws = await fetchEntityWorkspaceId();
        if (!alive) return;
        if (ws == null || ws !== snapWs) onMismatch();
      } catch {
        if (alive) onMismatch();
      }
    };

    const onWs = () => void verify();
    window.addEventListener('enflow-workspace-changed', onWs);
    void verify();
    return () => {
      alive = false;
      window.removeEventListener('enflow-workspace-changed', onWs);
    };
  }, [entityWorkspaceId, fetchEntityWorkspaceId, onMismatch]);
}

