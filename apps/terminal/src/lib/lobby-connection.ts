// apps/terminal/src/commands/lobby-connection.ts

import { EventCommands } from "@onezone/shared";
import type { AssignTaskPayload, ProjectBuilderCommandFinishedPayload, ProjectBuilderCommandPayload, ProjectBuilderCommandStopPayload } from "@onezone/shared";
import { IO_SERVER_DISCONNECT } from "./constants.js";
import { createLobbySocket } from "./task-socket.js";
import { runProjectBuilderCommand } from "./project-builder-command-runner.js";
import type { LobbyConnectionDeps } from "./types/index.js";

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

  const activeProjectBuilders = new Map<string, AbortController>();

  return new Promise<void>((_, reject) => {
    const lobbyConnection = createLobbySocket(serverUrl, terminalId, terminalName, {
      onConnect: () => {
        log(
          `[${terminalName}] Connected to ${serverUrl} | Waiting for task assignment...`,
        );
      },
      onMessage: (event: string, payload: unknown) => {
        if (event === EventCommands.ProjectBuilderCommand) {
          const commandPayload = payload as ProjectBuilderCommandPayload;
          const emitFinished = (status: ProjectBuilderCommandFinishedPayload["status"]) => {
            log(
              `[${terminalName}] Notifying server that project builder command ${commandPayload.commandId} finished with status ${status}`,
            );
            lobbyConnection.socket.emit(EventCommands.ProjectBuilderCommandFinished, {
              commandId: commandPayload.commandId,
              terminalId,
              terminalName,
              projectId: commandPayload.projectId,
              status,
            } satisfies ProjectBuilderCommandFinishedPayload);
          };
          const abortController = new AbortController();

          runProjectBuilderCommand(commandPayload, {
            serverUrl,
            terminalId,
            terminalName,
            signal: abortController.signal,
            log,
          })
            .then(() => undefined)
            .catch((err: Error) => {
              if (abortController.signal.aborted) return;
              log(
                `[${terminalName}] Project builder command failed: ${err.message}`,
              );
              emitFinished("failed");
            })
            .finally(() => {
              activeProjectBuilders.delete(commandPayload.projectId);
            });
          activeProjectBuilders.set(commandPayload.projectId, abortController);
          return;
        }

        if (event === EventCommands.ProjectBuilderCommandStop) {
          const stopPayload = payload as ProjectBuilderCommandStopPayload;
          const abortController = activeProjectBuilders.get(stopPayload.projectId);
          if (abortController) {
            log(
              `[${terminalName}] Stopping project builder command for project ${stopPayload.projectId}`,
            );
            abortController.abort();
            activeProjectBuilders.delete(stopPayload.projectId);
          }
          return;
        }

        if (event !== EventCommands.AssignTask) return;

        const { task } = payload as AssignTaskPayload;
        if (activeTaskIds.has(task.id)) {
          log(
            `[${terminalName}] Already connected to task: ${task.id}, skipping`,
          );
          return;
        }

        if (task.completedAt) {
          log(
            `[${terminalName}] Task ${task.id} is completed, skipping`,
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
      onConnectError: (_: string, err: Error) => {
        log(
          `[${terminalName}] Lobby connection failed (${err.message}), retrying...`,
        );
      },
      onDisconnect: (_: string, reason: string) => {
        if (reason === IO_SERVER_DISCONNECT) {
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
