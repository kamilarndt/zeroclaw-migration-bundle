export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'Todo' | 'InProgress' | 'Review' | 'Done';
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt?: string;
  updatedAt?: string;
}

export type TaskStatus = Task['status'];
