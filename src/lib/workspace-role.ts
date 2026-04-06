import { getCurrentUser } from '@/lib/user-api';
import { listWorkspaceMembers } from '@/lib/workspace-api';
import { getWorkspaceSnapshot, saveWorkspaceSnapshot } from '@/lib/workspace-storage';

/**
 * Đồng bộ roleInWorkspace của user hiện tại vào workspace snapshot.
 * Gọi sau khi switch workspace / sync workspace từ API để UI quyền hạn ổn định.
 */
export async function hydrateWorkspaceRoleInSnapshot(workspaceId: number): Promise<void> {
  try {
    const [me, members] = await Promise.all([
      getCurrentUser(),
      listWorkspaceMembers(workspaceId),
    ]);
    const role = members.find((m) => m.userId === me.userId)?.roleInWorkspace ?? '';
    const cur = getWorkspaceSnapshot();
    if (cur.workspaceId !== workspaceId) return;
    if ((cur.roleInWorkspace ?? '') === role) return;
    saveWorkspaceSnapshot({ ...cur, roleInWorkspace: role });
  } catch {
    // Không phá flow nếu lỗi mạng; giữ snapshot hiện tại.
  }
}

