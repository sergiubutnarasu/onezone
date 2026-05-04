// apps/terminal/src/commands/command-runner.ts

import { EventCommands, MessageStream } from "@onezone/shared";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io-client";
import { setupTerminalAgent } from "../agents/setup.js";
import { shellQuote, stripAnsi } from "../lib/helper.js";
import { runProcess } from "../lib/process-runner.js";
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

  const setupResult = setupProject(payload);
  if (!setupResult) {
    log(
      `[${terminalName}] [${roomId}] Failed to setup project environment, skipping command execution.`,
    );
    return;
  }

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
  const projectWorkDir = setupResult.projectWorkDir;
  const command = `${terminalAgent.cmd} ${shellQuote(content)}`;
  const cmdContent = `cd ${shellQuote(projectWorkDir)} && ${command}`;

  let cancelled = false;
  let resultSeen = false;

  const proc = runProcess({
    cmd: cmdContent,
    args: [],
    shell: true,
    onLine: (stream, line) => {
      const clean = stripAnsi(line);
      if (!clean) return;

      if (stream === MessageStream.Stderr) {
        stderrBuffer.push(clean);
        return;
      }

      socket.emit(EventCommands.OutputLine, {
        ...basePayload,
        stream,
        content: clean,
      });

      // Detect the final stream-json result line and kill the process so it
      // doesn't hang when Claude started child processes (e.g. dev servers).
      try {
        const parsed = JSON.parse(clean);
        if (parsed?.type === "result") {
          resultSeen = true;
          try {
            process.kill(-proc.pid!, "SIGTERM");
          } catch {
            proc.kill();
          }
        }
      } catch {
        // Not JSON — ignore.
      }
    },
    onExit: (exitCode) => {
      activeProcesses.delete(jobId);

      // If we already received the result line and killed the process ourselves,
      // treat it as a clean exit regardless of the signal exit code.
      const effectiveCode = resultSeen ? 0 : exitCode;

      if (effectiveCode !== 0) {
        for (const line of stderrBuffer) {
          socket.emit(EventCommands.OutputLine, {
            ...basePayload,
            stream: MessageStream.Stderr,
            content: line,
          });
        }
      }

      socket.emit(EventCommands.TerminalCommandExit, {
        ...basePayload,
        exitCode: effectiveCode,
      });

      const badge = effectiveCode === 0 ? "✔ done" : `✖ error (${effectiveCode})`;
      log(`[${terminalName}] [${roomId}] ${badge}: "${content}"`);
      if (!cancelled) {
        void onComplete?.(effectiveCode);
      }
    },
  });

  activeProcesses.set(jobId, {
    cleanup: () => {
      cancelled = true;
      try {
        // Kill the entire process group so any child processes the agent
        // spawned (sub-shells, editors, etc.) are also terminated.
        process.kill(-proc.pid!, 'SIGTERM');
      } catch {
        proc.kill();
      }
    },
  });
}
