export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
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
  description: string;
  color: string;
  tasksCount: number;
}
