// packages/shared/src/lib/runner-payload.ts

/**
 * Prefix used by the task runner when sending a prompt to the terminal agent.
 * The full prompt is this prefix followed by `\n\n` and a JSON payload.
 * The model is explicitly instructed to invoke the `onezone-runner` skill
 * with the JSON as `$ARGUMENTS[0]`.
 */
export const RUNNER_PROMPT_PREFIX =
  'Follow your custom instructions, then invoke the "onezone-runner" skill with the following JSON as $ARGUMENTS[0], then follow the skill\'s workflow exactly:';

/**
 * Prefix used by the task runner for tasks with `bypass` enabled. Instructs
 * the model to invoke the `onezone-bypass-runner` skill instead, which runs
 * the task's own instructions only (no kanban column instructions) and does
 * not traverse columns.
 */
export const BYPASS_RUNNER_PROMPT_PREFIX =
  'Follow your custom instructions, then invoke the "onezone-bypass-runner" skill with the following JSON as $ARGUMENTS[0], then follow the skill\'s workflow exactly:';

const RUNNER_PROMPT_PREFIXES = [RUNNER_PROMPT_PREFIX, BYPASS_RUNNER_PROMPT_PREFIX];

/**
 * Extracts the runner JSON payload from a command string.
 * Returns the parsed object, or `null` if the string doesn't match
 * a runner prompt format or the JSON is invalid.
 */
export function parseRunnerPayload<T = unknown>(command: string): T | null {
  const prefix = RUNNER_PROMPT_PREFIXES.find((p) => command.startsWith(p));
  if (!prefix) return null;
  try {
    return JSON.parse(command.slice(prefix.length).trim()) as T;
  } catch {
    return null;
  }
}
