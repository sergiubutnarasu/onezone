// apps/terminal/src/commands/lobby-connection.ts

import { AssignTaskPayload, EventCommands } from "@onezone/shared";
import { createLobbySocket } from "../lib/task-socket.js";

export interface LobbyConnectionDeps {
  serverUrl: string;
  terminalId: string;
  terminalName: string;
  activeTaskIds: Set<string>;
  onTaskAssigned: (taskId: string) => Promise<void>;
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

        const { taskId } = payload as AssignTaskPayload;
        if (activeTaskIds.has(taskId)) {
          log(
            `[${terminalName}] Already connected to task: ${taskId}, skipping`,
          );
          return;
        }

        log(`[${terminalName}] Assigned to task: ${taskId}`);
        activeTaskIds.add(taskId);
        onTaskAssigned(taskId).catch((err: Error) => {
          activeTaskIds.delete(taskId);
          log(
            `[${terminalName}] Task ${taskId} connection failed: ${err.message}`,
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
