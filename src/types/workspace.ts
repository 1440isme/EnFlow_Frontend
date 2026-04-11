/** Khớp dữ liệu workspace từ backend (JSON camelCase). */
export type WorkspaceSnapshot = {
  workspaceId: number | null;
  /** Chủ workspace (để hiển thị vai trò khi cần). */
  ownerUserId: number | null;
  name: string;
  workspaceKey: string;
  description: string;
  isPrivate: boolean;
  /** Vai trò của user hiện tại trong workspace đang chọn (owner/member/guest). */
  roleInWorkspace?: string;
};
