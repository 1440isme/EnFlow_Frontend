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

/** GET /notifications */
export type NotificationResponse = {
  notificationId: number;
  workspaceId: number | null;
  type: string;
  title: string;
  body: string | null;
  taskId: number | null;
  projectId: number | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationFeedResponse = {
  unreadCount: number;
  items: NotificationResponse[];
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

/** POST /workspaces/{id}/members — owner | member | guest (mời: member | guest) */
export type WorkspaceMemberRequest = {
  userId: number;
  roleInWorkspace: 'member' | 'guest' | null;
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

// --- PROJECTS ---
export type ProjectResponse = {
  idProject: number;
  name: string;
  projectKey: string;
  description: string;
  isPrivate: boolean;
  archived: boolean;
  workspaceId: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectCreationRequest = {
  workspaceId?: number;
  name: string;
  projectKey: string;
  description: string;
  isPrivate: boolean;
  archive: boolean;
  createdAt?: string;
};

// --- LISTS (Columns) ---
export type ProjectListResponse = {
  listProjectId: number;
  name: string;
  description: string;
  position: number;
  isPrivate: boolean;
  archived: boolean;
  createdAt?: string;
  updatedAt?: string;
  projectId: number;
};

export type ProjectListCreationRequest = {
  projectId?: number;
  name: string;
  description: string;
  position: number;
  isPrivate: boolean;
  archived: boolean;
  createdAt?: string;
};

export type ProjectListUpdateRequest = {
  name: string;
  projectKey?: string;
  description: string;
  position: number;
  archived: boolean;
  isPrivate: boolean;
};

// --- STATUSES ---
export type StatusesResponse = {
  statusId: number;
  /** Tùy chọn: nếu backend thêm cột name sau này. */
  name?: string | null;
  statusGroup: string;
  color: string;
  position: number;
  isDefault: boolean;
  listId: number;
  projectId: number;
};

export type ProjectListWithStatusesResponse = ProjectListResponse & {
  statuses: StatusesResponse[];
};

export type ProjectListStatusesResponse = {
  projectId: number;
  lists: ProjectListWithStatusesResponse[];
};

export type StatusesCreationRequest = {
  idProject?: number;
  idListProject?: number;
  color: string;
  statusGroup: string;
  position: string | number;
  isDefault: boolean;
};

export type StatusesUpdateRequest = {
  statusGroup: string;
  color: string;
  position: number;
  isDefault: boolean;
};

// --- TASKS ---
export type TaskResponse = {
  taskId: number;
  projectId: number;
  listId: number;
  statusId: number;
  parentTaskId: number | null;
  reporterId: number;
  taskCode: string;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  resolution: string | null;
  timeEstimateDays: number | null;
  timeSpentDays: number | null;
  points: number | null;
  position: number;
  isPrivate: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type TaskUpdateRequest = {
  listId?: number;
  statusId?: number;
  parentTaskId?: number | null;
  reporterId?: number;
  taskCode?: string;
  title?: string;
  description?: string;
  taskType?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  resolution?: string;
  timeEstimateDays?: number;
  timeSpentDays?: number;
  points?: number;
  position?: number;
  isPrivate?: boolean;
  archived?: boolean;
};

