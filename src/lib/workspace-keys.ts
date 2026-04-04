/** Personal workspace key — matches backend `workspaceKey`. */
export function personalWorkspaceKey(userId: number): string {
  return `personal-${userId}`;
}
