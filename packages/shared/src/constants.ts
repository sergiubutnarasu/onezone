// packages/shared/src/constants.ts

/** Heartbeat interval for agent → server keep-alive pings. */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Agents are considered stale (disconnected) if no heartbeat is received
 * within this window. Must be greater than HEARTBEAT_INTERVAL_MS.
 */
export const STALE_THRESHOLD_MS = 10_000;

/** Constructs the socket room ID for a given task. */
export function createTaskRoomId(taskId: string): string {
  return `task:${taskId}`;
}

/** Extracts the taskId from a task room ID. */
export function extractTaskId(roomId: string): string {
  return roomId.replace('task:', '');
}
