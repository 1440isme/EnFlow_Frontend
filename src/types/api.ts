/** Khớp AuthResponse từ POST /auth/login, /auth/register (camelCase). */
export type AuthUser = {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt?: string;
};

export type AuthResponse = {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  user: AuthUser;
};

/** GET /users/me, PUT /users/me — UserResponse. */
export type UserResponse = {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UserUpdateRequest = {
  fullName?: string;
  email?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/** GET /users/lookup?email=... */
export type UserPublicLookupResponse = {
  userId: number;
  fullName: string;
  email: string;
  avatarUrl: string | null;
};

export type WorkspaceResponse = {
  workspaceId: number;
  name: string;
  workspaceKey: string;
  description: string | null;
  ownerUserId: number;
  isPrivate: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkspaceUpdateRequest = {
  name: string;
  description: string;
  isPrivate: boolean;
};

/** POST /workspaces */
export type WorkspaceRequest = {
  name: string;
  workspaceKey: string | null;
  description: string;
  ownerUserId: number;
  isPrivate: boolean;
};

/** POST /workspaces/{id}/members — owner | admin | member | guest (UI thêm: admin, member, guest) */
export type WorkspaceMemberRequest = {
  userId: number;
  roleInWorkspace: 'admin' | 'member' | 'guest' | null;
};

/** GET /workspaces/{id}/members */
export type WorkspaceMemberResponse = {
  workspaceId: number;
  userId: number;
  roleInWorkspace: string;
  joinedAt?: string;
  isActive: boolean;
};

/** PUT /workspaces/{id}/members/{userId} */
export type WorkspaceMemberUpdateRequest = {
  roleInWorkspace: string;
  isActive: boolean;
};
