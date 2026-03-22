/** Khớp dữ liệu workspace từ backend (JSON camelCase). */
export type WorkspaceSnapshot = {
  workspaceId: number | null;
  /** Chủ workspace (để hiển thị vai trò khi cần). */
  ownerUserId: number | null;
  name: string;
  workspaceKey: string;
  description: string;
  isPrivate: boolean;
};
