import { TaskDetails, TaskStatus } from "@onezone/shared";
import { SpawnCommandProps } from "./command-runner.js";

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

  switch (task.status) {
    case TaskStatus.BACKLOG:
      log(
        `[${terminalName}] [${roomId}] Task is in BACKLOG status, skipping command execution.`,
      );
      return;
    case TaskStatus.TODO:
      log(
        `[${terminalName}] [${roomId}] Task is in TODO status, skipping command execution.`,
      );
      return;
    case TaskStatus.IN_PROGRESS:
      log(
        `[${terminalName}] [${roomId}] Task is IN_PROGRESS, executing command...`,
      );
      break;
    case TaskStatus.IN_REVIEW:
      log(
        `[${terminalName}] [${roomId}] Task is IN_REVIEW status, skipping command execution.`,
      );
      return;
    case TaskStatus.TESTING:
      log(
        `[${terminalName}] [${roomId}] Task is in TESTING status, skipping command execution.`,
      );
      return;
    case TaskStatus.DONE:
      log(
        `[${terminalName}] [${roomId}] Task is in DONE status, skipping command execution.`,
      );
      return;
  }
};
