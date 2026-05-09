// apps/terminal/src/commands/command-runner.ts

import { EventCommands, MessageStream } from "@onezone/shared";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io-client";
import { setupTerminalAgent } from "../agents/setup.js";
import { shellQuote, stripAnsi } from "../lib/helper.js";
import { killTree, runProcess } from "../lib/process-runner.js";
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
  onComplete?: (exitCode: number) => Promise<void>;
}

/**
 * Spawns a user command inside the project workdir using the configured
 * terminal agent, streaming stdout lines back over the socket and emitting
 * start/exit lifecycle events.
 */
export function spawnCommand({
  content,
  payload,
  deps,
  activeProcesses,
  onComplete,
}: SpawnCommandProps): void {
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
  };

  socket.emit(EventCommands.TerminalCommandStart, basePayload);

  const stderrBuffer: string[] = [];

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

  const setupResult = setupProject(payload, emitSetupLine);
  if (!setupResult) {
    log(
      `[${terminalName}] [${roomId}] Failed to setup project environment, skipping command execution.`,
    );
    return;
  }

  const projectWorkDir = setupResult.projectWorkDir;
  const command = `${terminalAgent.cmd} ${shellQuote(content)}`;

  let cancelled = false;
  let resultSeen = false;
  let resultUsage: {
    totalCostUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
  } | null = null;

  const proc = runProcess({
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
          resultSeen = true;
          if (proc.pid) killTree(proc.pid);
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
      const effectiveCode = resultSeen ? 0 : exitCode;

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
        ...(resultUsage ?? {}),
      });

      const badge =
        effectiveCode === 0 ? "✔ done" : `✖ error (${effectiveCode})`;
      log(`[${terminalName}] [${roomId}] ${badge}: "${content}"`);
      if (!cancelled) {
        void onComplete?.(effectiveCode);
      }
    },
  });

  activeProcesses.set(jobId, {
    cleanup: () => {
      cancelled = true;
      if (proc.pid) killTree(proc.pid);
    },
  });
}
