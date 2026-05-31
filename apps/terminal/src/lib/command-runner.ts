// apps/terminal/src/commands/command-runner.ts

import { EventCommands, MessageStream } from "@onezone/shared";
import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io-client";
import { setupTerminalAgent } from "../agents/setup.js";
import { shellQuote, stripAnsi } from "../lib/helper.js";
import { runProcess, terminateTree } from "../lib/process-runner.js";
import { setupProject } from "../lib/setup.js";

export interface CommandRunnerDeps {
  socket: Socket;
  roomId: string;
  terminalId: string;
  terminalName: string;
  serverUrl: string;
  log: (message: string, ...args: unknown[]) => void;
}

export interface ActiveProcessEntry {
  cleanup: () => void;
}

export interface SpawnCommandProps {
  content: string;
  payload: unknown;
  deps: CommandRunnerDeps;
  activeProcesses: Map<string, ActiveProcessEntry>;
  /** When true, parses [[ONEZONE_NEXT_COLUMN:...]] and emits taskRunnerFinished. Defaults to false. */
  isTaskRunner?: boolean;
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

  activeProcesses.set(jobId, {
    cleanup: () => {
      cancelled = true;
      setupAbortController.abort();
      if (proc?.pid) terminateTree(proc.pid);
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
    activeProcesses.delete(jobId);
    socket.emit(EventCommands.TerminalCommandExit, {
      ...basePayload,
      exitCode: cancelled ? 130 : 1,
      ts: Date.now(),
    });
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
    onLine: (stream, line) => {
      const clean = stripAnsi(line);
      if (!clean) return;

      if (stream === MessageStream.Stderr) {
        stderrBuffer.push(clean);
        return;
      }

      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      try {
        const parsed = JSON.parse(clean);
        if (parsed?.type === "assistant" && parsed?.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens ?? undefined;
          outputTokens = parsed.message.usage.output_tokens ?? undefined;
        } else if (parsed?.type === "result") {
          resultUsage = {
            totalCostUsd: parsed.total_cost_usd ?? undefined,
            inputTokens: parsed.usage?.input_tokens ?? undefined,
            outputTokens: parsed.usage?.output_tokens ?? undefined,
          };
          resultReceived = true;
          if (isTaskRunner) {
            const match = (parsed.result as string | undefined)?.match(
              /\[\[ONEZONE_NEXT_COLUMN:(\S+)\]\]/,
            );
            if (match) {
              nextColumnId = match[1] === "backlog" ? null : match[1];
            }
            taskRunnerFinished = true;
          }
          killRunningProcess();
        }
      } catch {
        // Not JSON — ignore.
      }

      socket.emit(EventCommands.OutputLine, {
        ...basePayload,
        stream,
        content: clean,
        ts: Date.now(),
        ...(inputTokens !== undefined || outputTokens !== undefined
          ? { inputTokens, outputTokens }
          : {}),
      });
    },
    onExit: (exitCode) => {
      activeProcesses.delete(jobId);

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

      socket.emit(EventCommands.TerminalCommandExit, {
        ...basePayload,
        exitCode: effectiveCode,
        ts: Date.now(),
        taskRunnerFinished: taskRunnerFinished && !cancelled,
        ...(taskRunnerFinished && !cancelled ? { nextColumnId } : {}),
        ...(resultUsage ?? {}),
      });

      const badge =
        effectiveCode === 0 ? "✔ done" : `✖ error (${effectiveCode})`;
      log(`[${terminalName}] [${roomId}] ${badge}: "${content}"`);
    },
  });

}
