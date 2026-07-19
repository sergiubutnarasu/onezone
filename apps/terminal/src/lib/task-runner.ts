import {
  BYPASS_RUNNER_PROMPT_PREFIX,
  RUNNER_PROMPT_PREFIX,
  TaskDetails,
} from "@onezone/shared";
import { spawnCommand } from "./command-runner.js";
import type { TaskRunnerProps } from "./types/index.js";

export const taskRunner = ({
  payload,
  deps,
  activeProcesses,
}: TaskRunnerProps) => {
  const { roomId, terminalName, log } = deps;

  const task = (payload as { task?: unknown }).task as TaskDetails | undefined;

  if (!task || typeof task !== "object") {
    log(
      `[${terminalName}] [${roomId}] Invalid task payload, skipping command execution.`,
    );
    return;
  }

  if (!task.column?.id) {
    log(
      `[${terminalName}] [${roomId}] Task is in Backlog, skipping command execution.`,
    );
    return;
  }

  if (task.completedAt) {
    log(
      `[${terminalName}] [${roomId}] Task is completed, skipping command execution.`,
    );
    return;
  }

  const input = task.bypass
    ? {
        taskId: task.id,
        taskName: task.name,
        taskDescription: task.description,
        kanbanColumnName: "Bypass",
        projectId: task.project.id,
        repository: task.project.repository ?? undefined,
        serverUrl: deps.serverUrl,
      }
    : {
        taskId: task.id,
        taskName: task.name,
        taskDescription: task.description,
        projectId: task.project.id,
        kanbanColumnId: task.columnId,
        kanbanColumnName: task.column?.name,
        kanbanColumnInstructions: task.column?.instructions,
        repository: task.project.repository ?? undefined,
        serverUrl: deps.serverUrl,
      };

  const prefix = task.bypass
    ? BYPASS_RUNNER_PROMPT_PREFIX
    : RUNNER_PROMPT_PREFIX;

  spawnCommand({
    content: `${prefix}\n\n${JSON.stringify(input)}`,
    payload,
    deps,
    activeProcesses,
    isTaskRunner: true,
  }).catch((err) =>
    deps.log(
      `[${deps.terminalName}] [${deps.roomId}] spawnCommand error: ${(err as Error).message}`,
    ),
  );
};
