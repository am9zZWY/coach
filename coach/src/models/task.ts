export interface Task {
  id: string;
  type: 'Task' | 'Project',
  title: string;
  createdDate: Date;
  dueDate?: Date;
  priority: Priority;
  completed: boolean;
  subTasks: Task[];
  parentId?: string;
}

export enum Priority {
  Low = 1,
  Medium = 2,
  High = 3,
  Urgent = 4,
  Critical = 5
}
