// packages/shared/src/constants.ts

/** Heartbeat interval for terminal → server keep-alive pings. */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Terminals are considered stale (disconnected) if no heartbeat is received
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

/** Constructs the socket room ID for a given project. */
export function createProjectRoomId(projectId: string): string {
  return `project:${projectId}`;
}

/**
 * Prefix used by the task runner when sending a prompt to the terminal agent.
 * The full prompt is this prefix followed by `\n\n` and a JSON payload.
 * The model is explicitly instructed to invoke the `onezone-runner` skill
 * with the JSON as `$ARGUMENTS[0]`.
 */
export const RUNNER_PROMPT_PREFIX =
  'Invoke the "onezone-runner" skill with the following JSON as $ARGUMENTS[0], then follow the skill\'s workflow exactly:';

/**
 * Extracts the runner JSON payload from a command string.
 * Returns the parsed object, or `null` if the string doesn't match
 * the runner prompt format or the JSON is invalid.
 */
export function parseRunnerPayload<T = unknown>(command: string): T | null {
  if (!command.startsWith(RUNNER_PROMPT_PREFIX)) return null;
  try {
    return JSON.parse(command.slice(RUNNER_PROMPT_PREFIX.length).trim()) as T;
  } catch {
    return null;
  }
}
