import { TaskDetails, KanbanColumn } from "@onezone/shared";
import { spawnCommand, SpawnCommandProps } from "./command-runner.js";

function getNextColumn(task: TaskDetails): KanbanColumn | undefined {
  const columns = task.project?.kanbanColumns ?? [];
  if (!task.columnId) {
    // Task is in backlog — no automatic advancement
    return undefined;
  }
  const sortedColumns = [...columns].sort((a, b) => a.index - b.index);
  const currentIdx = sortedColumns.findIndex((c) => c.id === task.columnId);
  return currentIdx >= 0 && currentIdx < sortedColumns.length - 1
    ? sortedColumns[currentIdx + 1]
    : undefined;
}

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
    kanbanColumnInstructions: task.column?.instructions,
  };

  spawnCommand({
    content: `/onezone-runner ${JSON.stringify(input)}`,
    payload,
    deps,
    activeProcesses,
  });

  // const nextColumn = getNextColumn(task);
  // const onComplete = nextColumn
  //   ? async (_exitCode: number) => {
  //       await fetch(`${deps.serverUrl}/tasks/${task.id}/column`, {
  //         method: "PATCH",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({ columnId: nextColumn.id }),
  //       });
  //     }
  //   : undefined;

  // const lowerName = columnName.toLowerCase();

  // if (lowerName === "planning") {
  //   log(
  //     `[${terminalName}] [${roomId}] Task is in PLANNING status, starting command execution...`,
  //   );

  //   spawnCommand({
  //     content: `/onezone-planner ${task.description || ""}`,
  //     payload,
  //     deps,
  //     activeProcesses,
  //     onComplete,
  //   });

  //   return;
  // }

  // if (lowerName === "in progress") {
  //   log(
  //     `[${terminalName}] [${roomId}] Task is In Progress, executing command...`,
  //   );
  //   spawnCommand({
  //     content: `/onezone-developer`,
  //     payload,
  //     deps,
  //     activeProcesses,
  //     onComplete,
  //   });
  //   return;
  // }

  // if (lowerName === "in review") {
  //   log(
  //     `[${terminalName}] [${roomId}] Task is In Review, executing command...`,
  //   );
  //   spawnCommand({
  //     content: `/onezone-reviewer`,
  //     payload,
  //     deps,
  //     activeProcesses,
  //     onComplete,
  //   });
  //   return;
  // }

  // if (lowerName === "testing") {
  //   log(
  //     `[${terminalName}] [${roomId}] Task is in Testing, executing command...`,
  //   );
  //   spawnCommand({
  //     content: `/onezone-tester`,
  //     payload,
  //     deps,
  //     activeProcesses,
  //     onComplete,
  //   });
  //   return;
  // }

  // log(
  //   `[${terminalName}] [${roomId}] Task is in column "${columnName}", no specific handler — skipping.`,
  // );
};
