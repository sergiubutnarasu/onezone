export type NotificationType = 'TASK_COMPLETED' | 'COMMAND_START' | 'COMMAND_EXIT_SUCCESS' | 'COMMAND_EXIT_FAILURE';

export interface Notification {
  id: string;
  type: NotificationType;
  taskId: string;
  task: { id: string; name: string };
  projectId: string;
  project: { id: string; name: string };
  message: string;
  readAt: string | null;
  createdAt: string;
}
