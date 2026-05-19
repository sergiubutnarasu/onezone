import { TaskDetails } from "@onezone/shared";
import { spawnCommand, SpawnCommandProps } from "./command-runner.js";

export interface TaskRunnerProps extends Omit<SpawnCommandProps, "content"> {}

export const taskRunner = ({
  payload,
  deps,
  activeProcesses,
}: TaskRunnerProps) => {
  const { socket, roomId, terminalId, terminalName, log } = deps;

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

  const input = {
    taskId: task.id,
    taskName: task.name,
    taskDescription: task.description,
    projectId: task.project.id,
    kanbanColumnId: task.columnId,
    kanbanColumnName: task.column?.name,
    kanbanColumnInstructions: task.column?.instructions,
    serverUrl: deps.serverUrl,
  };

  spawnCommand({
    content: `/onezone-runner ${JSON.stringify(input)}`,
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
