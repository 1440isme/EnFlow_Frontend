export type Priority = 'low' | 'medium' | 'high' | 'urgent' | 'normal';

/** Nhóm workflow backend (enum `statusGroup`) — dùng cho màu / KPI / hoàn thành. */
export type TaskStatusBucket = 'todo' | 'in-progress' | 'completed';

/** `status`: nhãn hiển thị (tên cột status). `statusGroup`: nhóm backend (vd. `completed`, `in_progress`). */
export type Status = string | number;

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  /** Enum backend gắn với status hiện tại — bắt buộc khi có `statusId` từ API. */
  statusGroup?: string;
  /** Màu cột status từ API (`StatusesResponse.color`) — ưu tiên cho badge/dot. */
  statusColor?: string | null;
  statusId?: number;
  listId?: number;
  priority: Priority;
  assignee: string;
  assigneeAvatar: string;
  /** Chuỗi id project — dùng để lọc khớp `project.id` (ProjectsPage). */
  project: string;
  /** Tên hiển thị khi API có `projectName`. */
  projectDisplayName?: string;
  dueDate: string;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  color: string;
  tasksCount: number;
}
