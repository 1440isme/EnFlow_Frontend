/** Chuỗi role từ API (chữ thường). */
export function formatWorkspaceRole(role: string): string {
  const r = role.toLowerCase();
  if (r === 'owner') return 'Owner';
  if (r === 'member') return 'Member';
  if (r === 'guest') return 'Guest';
  // Dữ liệu cũ / lỗi thời
  if (r === 'admin') return 'Member';
  return role || '—';
}

/** Chỉ Owner quản lý team (đổi vai trò Member/Guest, mời, gỡ). Member/Guest chỉ xem. */
export function canManageTeamMembers(myRole: string): boolean {
  return myRole.toLowerCase() === 'owner';
}

/** @deprecated dùng canManageTeamMembers */
export function canManageWorkspaceMembers(myRole: string): boolean {
  return canManageTeamMembers(myRole);
}

export function isOwnerRole(role: string): boolean {
  return role.toLowerCase() === 'owner';
}

/** Vai trò có thể gán cho thành viên mới / chỉnh sửa (không gồm Owner). */
export const ASSIGNABLE_TEAM_ROLES = ['member', 'guest'] as const;
export type AssignableTeamRole = (typeof ASSIGNABLE_TEAM_ROLES)[number];
