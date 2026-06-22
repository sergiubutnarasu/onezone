// apps/terminal/src/commands/command-runner.ts

import { EventCommands, MessageStream } from "@onezone/shared";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io-client";
import { setupTerminalAgent } from "../agents/setup.js";
import { setupProject } from "../lib/setup.js";
import {
  COMMAND_EXIT_ACK_TIMEOUT_MS,
  COMMAND_EXIT_WARN_ATTEMPTS,
} from "./constants.js";
import { AgentEventType } from "./types/index.js";
import type { SpawnCommandProps } from "./types/index.js";

function waitForSocketConnect(socket: Socket, timeoutMs: number): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      resolve(false);
    }, timeoutMs);
    timer.unref();

    const onConnect = () => {
      clearTimeout(timer);
      resolve(true);
    };

    socket.once("connect", onConnect);
  });
}

async function emitCommandExitUntilAck({
  socket,
  payload,
  log,
  terminalName,
  roomId,
  isSocketClosed,
}: {
  socket: Socket;
  payload: Record<string, unknown>;
  log: (message: string, ...args: unknown[]) => void;
  terminalName: string;
  roomId: string;
  isSocketClosed: () => boolean;
}): Promise<void> {
  let attempt = 0;

  while (!isSocketClosed()) {
    attempt++;
    const connected = await waitForSocketConnect(
      socket,
      COMMAND_EXIT_ACK_TIMEOUT_MS,
    );
    if (!connected || isSocketClosed()) continue;

    const acknowledged = await new Promise<boolean>((resolve) => {
      socket.timeout(COMMAND_EXIT_ACK_TIMEOUT_MS).emit(
        EventCommands.TerminalCommandExit,
        payload,
        (err: Error | null, response?: { status?: string }) => {
          resolve(!err && response?.status === "ok");
        },
      );
    });

    if (acknowledged) return;

    if (attempt === COMMAND_EXIT_WARN_ATTEMPTS) {
      log(
        `[${terminalName}] [${roomId}] Command exit acknowledgement was not received for job ${String(payload.jobId)}, retrying until the socket closes...`,
      );
    }
  }
}

/**
 * Spawns a user command inside the project workdir using the configured
 * terminal agent, streaming stdout lines back over the socket and emitting
 * start/exit lifecycle events.
 */
export async function spawnCommand({
  content,
  payload,
  deps,
  activeProcesses,
  isTaskRunner = false,
}: SpawnCommandProps): Promise<void> {
  const { socket, roomId, terminalId, terminalName, log } = deps;

  const terminalAgent = setupTerminalAgent(payload);
  if (!terminalAgent) {
    log(
      `[${terminalName}] [${roomId}] No terminal agent configured, skipping command execution.`,
    );
    return;
  }

  log(`[${terminalName}] [${roomId}] Spawning: ${content}`);

  const jobId = randomUUID();
  const basePayload = {
    roomId,
    terminalId,
    terminalName,
    jobId,
    command: content,
    agentId: terminalAgent.agentId,
    agentName: terminalAgent.agentName,
    model: terminalAgent.model,
  };

  socket.emit(EventCommands.TerminalCommandStart, basePayload);

  const setupAbortController = new AbortController();
  let cancelled = false;

  activeProcesses.set(jobId, {
    cleanup: () => {
      cancelled = true;
      setupAbortController.abort();
    },
  });

  // Setup messages are emitted synchronously in a tight loop — Date.now() alone
  // returns the same ms value for all of them, so we use a counter for strict ordering.
  let setupTs = Date.now();
  const emitSetupLine = (message: string) =>
    socket.emit(EventCommands.OutputLine, {
      ...basePayload,
      stream: MessageStream.Stdout,
      content: message,
      ts: setupTs++,
    });

  const setupResult = await setupProject(
    payload,
    emitSetupLine,
    setupAbortController.signal,
  );
  if (!setupResult) {
    void emitCommandExitUntilAck({
      socket,
      log,
      terminalName,
      roomId,
      isSocketClosed: deps.isSocketClosed,
      payload: {
        ...basePayload,
        exitCode: cancelled ? 130 : 1,
        ts: Date.now(),
      },
    }).finally(() => activeProcesses.delete(jobId));
    log(
      `[${terminalName}] [${roomId}] Failed to setup project environment, skipping command execution.`,
    );
    return;
  }

  const projectWorkDir = setupResult.projectWorkDir;

  let resultReceived = false;
  let taskRunnerFinished = false;
  let resultUsage: {
    totalCostUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
  } | null = null;
  let nextColumnId: string | null | undefined = undefined;

  const runAbortController = new AbortController();

  activeProcesses.set(jobId, {
    cleanup: () => {
      cancelled = true;
      runAbortController.abort();
    },
  });

  try {
    for await (const event of terminalAgent.config.run({
      prompt: content,
      cwd: projectWorkDir,
      signal: runAbortController.signal,
    })) {
      switch (event.type) {
        case AgentEventType.Text:
          socket.emit(EventCommands.OutputLine, {
            ...basePayload,
            stream: MessageStream.Stdout,
            content: event.content,
            ts: Date.now(),
          });
          break;

        case AgentEventType.Usage:
          // Per-turn usage is not emitted as a separate line — it would
          // create empty messages in the UI. Final usage is carried in
          // the result event and sent with TerminalCommandExit.
          break;

        case AgentEventType.Stderr:
          socket.emit(EventCommands.OutputLine, {
            ...basePayload,
            stream: MessageStream.Stderr,
            content: event.content,
            ts: Date.now(),
          });
          break;

        case AgentEventType.Result:
          resultUsage = event.usage ?? null;
          resultReceived = true;
          if (isTaskRunner && event.finished) {
            nextColumnId = event.nextColumnId;
            taskRunnerFinished = true;
          }
          break;
      }
    }
  } catch (err) {
    if (!cancelled) {
      socket.emit(EventCommands.OutputLine, {
        ...basePayload,
        stream: MessageStream.Stderr,
        content: `Agent error: ${(err as Error).message}`,
        ts: Date.now(),
      });
    }
  }

  const effectiveCode = resultReceived ? 0 : cancelled ? 130 : 1;

  void emitCommandExitUntilAck({
    socket,
    log,
    terminalName,
    roomId,
    isSocketClosed: deps.isSocketClosed,
    payload: {
      ...basePayload,
      exitCode: effectiveCode,
      ts: Date.now(),
      taskRunnerFinished: taskRunnerFinished && !cancelled,
      ...(taskRunnerFinished && !cancelled ? { nextColumnId } : {}),
      ...(resultUsage ?? {}),
    },
  }).finally(() => activeProcesses.delete(jobId));

  const badge =
    effectiveCode === 0 ? "✔ done" : `✖ error (${effectiveCode})`;
  log(`[${terminalName}] [${roomId}] ${badge}: "${content}"`);
}
