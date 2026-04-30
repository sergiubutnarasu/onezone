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
    },
    onExit: (exitCode) => {
      activeProcesses.delete(jobId);

      if (exitCode !== 0) {
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
        exitCode,
      });

      const badge = exitCode === 0 ? "✔ done" : `✖ error (${exitCode})`;
      log(`[${terminalName}] [${roomId}] ${badge}: "${content}"`);
      void onComplete?.(exitCode);
    },
  });

  activeProcesses.set(jobId, { cleanup: () => proc.kill() });
}
