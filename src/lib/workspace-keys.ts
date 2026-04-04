/** Khóa workspace cá nhân — khớp backend `workspaceKey`. */
export function personalWorkspaceKey(userId: number): string {
  return `personal-${userId}`;
}
