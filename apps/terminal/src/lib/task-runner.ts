import { TASK_STATUS_COLUMNS, TaskDetails, TaskStatus } from "@onezone/shared";
import { spawnCommand, SpawnCommandProps } from "./command-runner.js";

const getNextStatus = (current: TaskStatus): TaskStatus | undefined => {
  const idx = TASK_STATUS_COLUMNS.indexOf(current);
  return idx >= 0 && idx < TASK_STATUS_COLUMNS.length - 1
    ? TASK_STATUS_COLUMNS[idx + 1]
    : undefined;
};

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

  const nextStatus = getNextStatus(task.status);
  const onComplete = nextStatus
    ? async (_exitCode: number) => {
        await fetch(`${deps.serverUrl}/tasks/${task.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      }
    : undefined;

  switch (task.status) {
    case TaskStatus.BACKLOG: {
      log(
        `[${terminalName}] [${roomId}] Task is in BACKLOG status, skipping command execution.`,
      );
      return;
    }
    case TaskStatus.TODO: {
      log(
        `[${terminalName}] [${roomId}] Task is in TODO status, starting command execution...`,
      );

      spawnCommand({
        content: `/onezone-planner ${task.description || ""}`,
        payload,
        deps,
        activeProcesses,
        onComplete,
      });

      break;
    }
    case TaskStatus.IN_PROGRESS: {
      log(
        `[${terminalName}] [${roomId}] Task is IN_PROGRESS, executing command...`,
      );

      spawnCommand({
        content: `/onezone-developer`,
        payload,
        deps,
        activeProcesses,
        onComplete,
      });

      break;
    }
    case TaskStatus.IN_REVIEW: {
      log(
        `[${terminalName}] [${roomId}] Task is IN_REVIEW status, executing command...`,
      );
      spawnCommand({
        content: `/onezone-reviewer`,
        payload,
        deps,
        activeProcesses,
        onComplete,
      });

      break;
    }
    case TaskStatus.TESTING: {
      log(
        `[${terminalName}] [${roomId}] Task is in TESTING status, executing command...`,
      );
      spawnCommand({
        content: `/onezone-tester`,
        payload,
        deps,
        activeProcesses,
        onComplete,
      });
      break;
    }
    case TaskStatus.DONE: {
      log(
        `[${terminalName}] [${roomId}] Task is in DONE status, skipping command execution.`,
      );
      return;
    }
  }
};
