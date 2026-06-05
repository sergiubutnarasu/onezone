// apps/terminal/src/commands/task-connection.ts

import {
  ChatMessage,
  EventCommands,
  MessageRole,
  TaskDetails,
  createTaskRoomId,
} from "@onezone/shared";
import { IO_SERVER_DISCONNECT } from "../lib/constants.js";
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
    const processedChatMessageIds = new Set<string>();
    let closedIntentionally = false;

    const cleanupActiveProcesses = () => {
      for (const entry of activeProcesses.values()) {
        entry.cleanup();
      }
      activeProcesses.clear();
    };

    const { socket, cleanup: cleanupSocket, isClosed: isSocketClosed } = createTaskSocket(
      serverUrl,
      taskId,
      terminalId,
      terminalName,
      {
        onConnect: () => {
          const deps = { socket, roomId, terminalId, terminalName, serverUrl, log, isSocketClosed };

          // After a socket reconnect (e.g. token refresh), a process may still
          // be running from the previous connection. Skip re-launching the task
          // runner to avoid duplicating work; the existing process will continue
          // streaming output over the re-established socket.
          if (activeProcesses.size > 0) {
            log(`[${terminalName}] [${roomId}] Reconnected — process still running, resuming`);
            return;
          }

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
          const deps = { socket, roomId, terminalId, terminalName, serverUrl, log, isSocketClosed };

          switch (event) {
            case EventCommands.TaskDeleted: {
              log(
                `[${terminalName}] [${roomId}] Task deleted, disconnecting...`,
              );
              closedIntentionally = true;
              cleanupActiveProcesses();
              activeTaskIds.delete(taskId);
              cleanupSocket();
              resolve();
              break;
            }

            case EventCommands.TerminalCommandStop: {
              const { jobId } = payload as { jobId: string };
              const entry = activeProcesses.get(jobId);
              if (entry) {
                log(`[${terminalName}] [${roomId}] Stopping job ${jobId}`);
                entry.cleanup();
              }
              break;
            }

            case EventCommands.TerminalCommandPing: {
              const { jobId, input } = payload as { jobId: string; input: string };
              const entry = activeProcesses.get(jobId);
              if (entry?.writeStdin) {
                log(`[${terminalName}] [${roomId}] Pinging job ${jobId} with input: ${input}`);
                entry.writeStdin(input + "\n");
              } else {
                log(`[${terminalName}] [${roomId}] Ping ignored — no active job ${jobId} (found=${!!entry}, hasWriteStdin=${!!entry?.writeStdin})`);
              }
              break;
            }

            case EventCommands.TaskColumnUpdated: {
              const message = payload as ChatMessage;
              log(
                `[${terminalName}] [${roomId}] Task column updated: ${message?.task?.name} → ${message?.task?.column?.name ?? 'Backlog'}`,
              );

              // Terminate any running processes before handling the new status
              cleanupActiveProcesses();

              if (message.task?.completedAt) {
                log(
                  `[${terminalName}] [${roomId}] Task completed, disconnecting...`,
                );
                closedIntentionally = true;
                activeTaskIds.delete(taskId);
                cleanupSocket();
                resolve();
                break;
              }

              taskRunner({
                payload,
                deps,
                activeProcesses,
              });

              break;
            }

            case EventCommands.TerminalCommandRun: {
              const message = payload as ChatMessage;
              if (message.role !== MessageRole.User) break;

              // A saved message id makes command spawning idempotent if the
              // server ever retries command delivery after a reconnect.
              const messageId = (message as { id?: unknown }).id;
              if (typeof messageId === "string") {
                if (processedChatMessageIds.has(messageId)) break;
                processedChatMessageIds.add(messageId);
              }

              const content = message.content.trim();
              if (!content) break;

              spawnCommand({
                content,
                payload,
                deps,
                activeProcesses,
              }).catch((err) =>
                deps.log(`[${terminalName}] [${roomId}] spawnCommand error: ${(err as Error).message}`),
              );
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
          if (closedIntentionally) return;

          if (reason === IO_SERVER_DISCONNECT) {
            // Kill any running processes — the connection is gone for good
            // (either the token refresh failed or the server kicked us).
            cleanupActiveProcesses();
            cleanupSocket();

            if (!activeTaskIds.has(taskId)) {
              // Task was deleted — clean exit
              resolve();
            } else {
              activeTaskIds.delete(taskId);
              reject(new Error(`[${roomId}] Disconnected: ${reason}`));
            }
          } else {
            if (activeProcesses.size === 0) {
              activeTaskIds.delete(taskId);
              cleanupSocket();
              reject(new Error(`[${roomId}] Disconnected: ${reason}`));
              return;
            }

            log(
              `[${terminalName}] [${roomId}] Disconnected (${reason}), reconnecting...`,
            );
          }
        },
      },
    );
  });
}
