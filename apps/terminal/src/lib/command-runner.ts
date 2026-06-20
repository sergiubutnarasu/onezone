// apps/terminal/src/commands/command-runner.ts

import { EventCommands, MessageStream } from "@onezone/shared";
import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io-client";
import { setupTerminalAgent } from "../agents/setup.js";
import {
  createAgentOutputParser,
  type AgentOutputParser,
} from "../lib/agent-output-parsers/index.js";
import { shellQuote, stripAnsi } from "../lib/helper.js";
import { runProcess, terminateTree } from "../lib/process-runner.js";
import { setupProject } from "../lib/setup.js";
import {
  COMMAND_EXIT_ACK_TIMEOUT_MS,
  COMMAND_EXIT_WARN_ATTEMPTS,
} from "./constants.js";
import type { ActiveProcessEntry, CommandRunnerDeps, SpawnCommandProps } from "./types/index.js";

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

  const stderrBuffer: string[] = [];
  const setupAbortController = new AbortController();
  let cancelled = false;
  let proc: ChildProcess | undefined;

  let writeStdin: ((data: string) => void) | undefined;

  activeProcesses.set(jobId, {
    cleanup: () => {
      cancelled = true;
      setupAbortController.abort();
      if (proc?.pid) terminateTree(proc.pid);
    },
    writeStdin: (data: string) => {
      if (!writeStdin) {
        log(`[${terminalName}] [${roomId}] writeStdin called but no stdin writer available for job ${jobId}`);
        return;
      }
      log(`[${terminalName}] [${roomId}] Writing to job ${jobId} stdin: ${data.trim()}`);
      writeStdin(data);
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
  const command = `${terminalAgent.config.cmd} ${shellQuote(content)}`;
  const killRunningProcess = () => {
    if (proc?.pid) terminateTree(proc.pid);
  };

  const parseAgentLine: AgentOutputParser = createAgentOutputParser(
    terminalAgent.config.tag,
  );

  let resultReceived = false;
  let taskRunnerFinished = false;
  let resultUsage: {
    totalCostUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
  } | null = null;
  let nextColumnId: string | null | undefined = undefined;

  proc = runProcess({
    cmd: command,
    args: [],
    shell: true,
    cwd: projectWorkDir,
    onStdinReady: (write) => {
      writeStdin = write;
    },
    onLine: (stream, line) => {
      const clean = stripAnsi(line);
      if (!clean) return;

      if (stream === MessageStream.Stderr) {
        stderrBuffer.push(clean);
        return;
      }

      const parsed = parseAgentLine(clean);

      if (parsed?.result) {
        resultUsage = parsed.result.usage ?? null;
        resultReceived = true;
        if (isTaskRunner && parsed.result.finished) {
          nextColumnId = parsed.result.nextColumnId;
          taskRunnerFinished = true;
        }
        killRunningProcess();
      }

      if (parsed?.content) {
        socket.emit(EventCommands.OutputLine, {
          ...basePayload,
          stream,
          content: parsed.content,
          ts: Date.now(),
          ...(parsed.inputTokens !== undefined || parsed.outputTokens !== undefined
            ? { inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens }
            : {}),
        });
        return;
      }

      socket.emit(EventCommands.OutputLine, {
        ...basePayload,
        stream,
        content: clean,
        ts: Date.now(),
      });
    },
    onExit: (exitCode) => {
      // If we already received the result line and killed the process ourselves,
      // treat it as a clean exit regardless of the signal exit code.
      const effectiveCode = resultReceived ? 0 : exitCode;

      if (effectiveCode !== 0) {
        let stderrTs = Date.now();
        for (const line of stderrBuffer) {
          socket.emit(EventCommands.OutputLine, {
            ...basePayload,
            stream: MessageStream.Stderr,
            content: line,
            ts: stderrTs++,
          });
        }
      }

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
    },
  });

}
