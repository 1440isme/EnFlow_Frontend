export type Priority = 'low' | 'medium' | 'high' | 'urgent' | 'normal';
export type Status = string | number;

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  statusId?: number;
  listId?: number;
  priority: Priority;
  assignee: string;
  assigneeAvatar: string;
  project: string;
  dueDate: string;
  createdAt: string;
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
