// apps/terminal/src/commands/lobby-connection.ts

import { EventCommands } from "@onezone/shared";
import type { AssignTaskPayload, TaskDetails } from "@onezone/shared";
import { createLobbySocket } from "../lib/task-socket.js";

export interface LobbyConnectionDeps {
  serverUrl: string;
  terminalId: string;
  terminalName: string;
  activeTaskIds: Set<string>;
  onTaskAssigned: (task: TaskDetails) => Promise<void>;
  log: (message: string, ...args: unknown[]) => void;
}

/**
 * Connects to the lobby room and waits for task assignments.
 * Resolves only if the server explicitly disconnects the socket;
 * otherwise reconnects automatically.
 */
export function connectToLobby(deps: LobbyConnectionDeps): Promise<void> {
  const {
    serverUrl,
    terminalId,
    terminalName,
    activeTaskIds,
    onTaskAssigned,
    log,
  } = deps;

  return new Promise<void>((_, reject) => {
    createLobbySocket(serverUrl, terminalId, terminalName, {
      onConnect: () => {
        log(
          `[${terminalName}] Connected to ${serverUrl} | Waiting for task assignment...`,
        );
      },
      onMessage: (event, payload) => {
        if (event !== EventCommands.AssignTask) return;

        const { task } = payload as AssignTaskPayload;
        if (activeTaskIds.has(task.id)) {
          log(
            `[${terminalName}] Already connected to task: ${task.id}, skipping`,
          );
          return;
        }

        log(`[${terminalName}] Assigned to task: ${task.id}`);
        activeTaskIds.add(task.id);
        onTaskAssigned(task).catch((err: Error) => {
          activeTaskIds.delete(task.id);
          log(
            `[${terminalName}] Task ${task.id} connection failed: ${err.message}`,
          );
        });
      },
      onConnectError: (_, err) => {
        log(
          `[${terminalName}] Lobby connection failed (${err.message}), retrying...`,
        );
      },
      onDisconnect: (_, reason) => {
        if (reason === "io server disconnect") {
          reject(new Error(`Lobby disconnected: ${reason}`));
        } else {
          log(
            `[${terminalName}] Lobby disconnected (${reason}), reconnecting...`,
          );
        }
      },
    });
  });
}
