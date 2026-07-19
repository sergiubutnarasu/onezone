// packages/shared/src/lib/room-ids.ts

/** Constructs the socket room ID for a given task. */
export function createTaskRoomId(taskId: string): string {
  return `task:${taskId}`;
}

/** Extracts the taskId from a task room ID. */
export function extractTaskId(roomId: string): string {
  return roomId.replace('task:', '');
}

/** Constructs the socket room ID for a given project. */
export function createProjectRoomId(projectId: string): string {
  return `project:${projectId}`;
}

/** Constructs the socket room ID for a given user (used for user-scoped broadcasts like notifications). */
export function createUserRoomId(userId: string): string {
  return `user:${userId}`;
}
