// apps/terminal/src/commands/task-connection.ts

import {
  ChatMessage,
  EventCommands,
  MessageRole,
  TaskDetails,
  createTaskRoomId,
} from "@onezone/shared";
import { createTaskSocket } from "../lib/task-socket.js";
import type { ActiveProcessEntry } from "./command-runner.js";
import { spawnCommand } from "./command-runner.js";
import { taskRunner } from "./task-runner.js";

export interface TaskConnectionDeps {
  serverUrl: string;
  task: TaskDetails;
  terminalId: string;
  terminalName: string;
  activeTaskIds: Set<string>;
  log: (message: string, ...args: unknown[]) => void;
}

/**
 * Connects to a task room and handles incoming events using a switch-based
 * router. Resolves cleanly when the task is deleted; rejects on unexpected
 * disconnections.
 */
export function connectToTask(deps: TaskConnectionDeps): Promise<void> {
  const { serverUrl, task, terminalId, terminalName, activeTaskIds, log } =
    deps;
  const taskId = task.id;
  const roomId = createTaskRoomId(taskId);

  return new Promise<void>((resolve, reject) => {
    const activeProcesses = new Map<string, ActiveProcessEntry>();

    const { socket } = createTaskSocket(
      serverUrl,
      taskId,
      terminalId,
      terminalName,
      {
        onConnect: () => {
          const deps = { socket, roomId, terminalId, terminalName, serverUrl, log };

          log(
            `[${terminalName}] Connected to ${serverUrl} | room: ${roomId} | Listening for commands...`,
          );

          taskRunner({
            payload: { task },
            deps,
            activeProcesses,
          });
        },
        onMessage: (event, payload) => {
          const deps = { socket, roomId, terminalId, terminalName, serverUrl, log };

          switch (event) {
            case EventCommands.TaskDeleted: {
              log(
                `[${terminalName}] [${roomId}] Task deleted, disconnecting...`,
              );
              activeTaskIds.delete(taskId);
              break;
            }

            case EventCommands.TaskStatusUpdated: {
              const message = payload as ChatMessage;
              log(
                `[${terminalName}] [${roomId}] Task status updated: ${message?.task?.name} → ${message?.task?.status}`,
              );

              // Terminate any running processes before handling the new status
              for (const entry of activeProcesses.values()) {
                entry.cleanup();
              }
              activeProcesses.clear();

              taskRunner({
                payload,
                deps,
                activeProcesses,
              });

              break;
            }

            case EventCommands.ChatMessage: {
              const message = payload as ChatMessage;
              if (message.role !== MessageRole.User) break;

              const content = message.content.trim();
              if (!content) break;

              spawnCommand({
                content,
                payload,
                deps,
                activeProcesses,
              });
              break;
            }

            default:
              // Unhandled events are ignored
              break;
          }
        },
        onConnectError: (_, err) => {
          log(
            `[${terminalName}] [${roomId}] Connection failed (${err.message}), retrying...`,
          );
        },
        onDisconnect: (_, reason) => {
          if (reason === "io server disconnect") {
            if (!activeTaskIds.has(taskId)) {
              // Task was deleted — clean exit
              resolve();
            } else {
              activeTaskIds.delete(taskId);
              reject(new Error(`[${roomId}] Disconnected: ${reason}`));
            }
          } else {
            log(
              `[${terminalName}] [${roomId}] Disconnected (${reason}), reconnecting...`,
            );
          }
        },
      },
    );
  });
}
