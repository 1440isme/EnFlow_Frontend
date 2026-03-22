/** Chuỗi role từ API (chữ thường). */
export function formatWorkspaceRole(role: string): string {
  const r = role.toLowerCase();
  if (r === 'owner') return 'Chủ sở hữu';
  if (r === 'admin') return 'Quản trị';
  if (r === 'member') return 'Thành viên';
  if (r === 'guest') return 'Khách';
  return role || '—';
}

export function canManageWorkspaceMembers(myRole: string): boolean {
  const r = myRole.toLowerCase();
  return r === 'owner' || r === 'admin';
}

export function isOwnerRole(role: string): boolean {
  return role.toLowerCase() === 'owner';
}

/** Vai trò có thể gán qua PUT (không gồm owner). */
export const EDITABLE_MEMBER_ROLES = ['admin', 'member', 'guest'] as const;
export type EditableMemberRole = (typeof EDITABLE_MEMBER_ROLES)[number];
