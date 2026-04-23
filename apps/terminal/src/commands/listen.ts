// apps/terminal/src/commands/listen.ts

import { Command, Flags } from '@oclif/core';
import {
  AssignTaskPayload,
  ChatMessage,
  EventCommands,
  MessageRole,
  MessageStream,
  createTaskRoomId,
} from '@onezone/shared';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { registerCleanupHandlers, runProcess } from '../lib/process-runner.js';
import { stripAnsi } from '../lib/helper.js';
import { registerTerminal } from '../lib/terminal-registration.js';
import { createLobbySocket, createTaskSocket } from '../lib/task-socket.js';

export default class Listen extends Command {
  private readonly activeTaskIds = new Set<string>();

  static description =
    'Connect to a task room (or wait for one to be assigned) and stay open, spawning commands as users send messages in the chat';

  static examples = [
    '<%= config.bin %> listen',
    '<%= config.bin %> listen --task <taskId>',
    '<%= config.bin %> listen --task <taskId1> --task <taskId2>',
    '<%= config.bin %> listen --task <taskId> --name my-terminal',
  ];

  static flags = {
    task: Flags.string({
      description:
        'Task ID to connect to (can be repeated). If omitted, waits for the server to assign one.',
      required: false,
      multiple: true,
    }),
    server: Flags.string({
      description: 'Server URL',
      default: 'http://localhost:5026',
    }),
    name: Flags.string({
      description: 'Terminal name — must be unique across all running terminals',
      default: hostname(),
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Listen);

    const terminalName = flags.name;
    const taskIds = flags.task;

    let terminalId: string;
    try {
      terminalId = await registerTerminal({ serverUrl: flags.server, name: terminalName });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    this.log(`[${terminalName}] Terminal ID: ${terminalId}`);

    registerCleanupHandlers();

    const connections: Promise<void>[] = [
      this.connectToLobby(flags.server, terminalId, terminalName),
    ];

    if (taskIds?.length) {
      for (const taskId of taskIds) {
        this.activeTaskIds.add(taskId);
      }
      connections.push(
        ...taskIds.map((taskId) =>
          this.connectToTask(flags.server, taskId, terminalId, terminalName),
        ),
      );
    }

    await Promise.all(connections);
  }

  private connectToLobby(
    serverUrl: string,
    terminalId: string,
    terminalName: string,
  ): Promise<void> {
    return new Promise<void>((_, reject) => {
      createLobbySocket(serverUrl, terminalId, terminalName, {
        onConnect: () => {
          this.log(`[${terminalName}] Connected to ${serverUrl} | Waiting for task assignment...`);
        },
        onMessage: (event, payload) => {
          if (event === EventCommands.AssignTask) {
            const { taskId } = payload as AssignTaskPayload;
            if (this.activeTaskIds.has(taskId)) {
              this.log(`[${terminalName}] Already connected to task: ${taskId}, skipping`);
              return;
            }
            this.log(`[${terminalName}] Assigned to task: ${taskId}`);
            this.activeTaskIds.add(taskId);
            this.connectToTask(serverUrl, taskId, terminalId, terminalName).catch((err: Error) => {
              this.activeTaskIds.delete(taskId);
              this.log(`[${terminalName}] Task ${taskId} connection failed: ${err.message}`);
            });
          }
        },
        onConnectError: (_, err) => {
          this.log(`[${terminalName}] Lobby connection failed (${err.message}), retrying...`);
        },
        onDisconnect: (_, reason) => {
          if (reason === 'io server disconnect') {
            reject(new Error(`Lobby disconnected: ${reason}`));
          } else {
            this.log(`[${terminalName}] Lobby disconnected (${reason}), reconnecting...`);
          }
        },
      });
    });
  }

  private connectToTask(
    serverUrl: string,
    taskId: string,
    terminalId: string,
    terminalName: string,
  ): Promise<void> {
    const roomId = createTaskRoomId(taskId);

    return new Promise<void>((resolve, reject) => {
      const activeProcesses = new Map<string, ReturnType<typeof runProcess>>();

      const { socket } = createTaskSocket(serverUrl, taskId, terminalId, terminalName, {
        onConnect: () => {
          this.log(
            `[${terminalName}] Connected to ${serverUrl} | room: ${roomId} | Listening for commands...`,
          );
        },
        onMessage: (event, payload) => {
          if (event === EventCommands.TaskDeleted) {
            this.log(`[${terminalName}] [${roomId}] Task deleted, disconnecting...`);
            this.activeTaskIds.delete(taskId);
            return;
          }
          if (event !== EventCommands.ChatMessage) return;
          const message = payload as ChatMessage;
          if (message.role !== MessageRole.User) return;

          const content = message.content.trim();
          if (!content) return;

          this.log(`[${terminalName}] [${roomId}] Spawning: ${content}`);

          const jobId = randomUUID();
          const basePayload = { roomId, terminalId, terminalName, jobId, command: content };

          socket.emit(EventCommands.TerminalCommandStart, basePayload);

          const stderrBuffer: string[] = [];

          const proc = runProcess(
            content,
            [],
            (stream, line) => {
              const clean = stripAnsi(line);
              if (!clean) return;

              if (stream === MessageStream.Stderr) {
                stderrBuffer.push(clean);
                return;
              }

              socket.emit(EventCommands.OutputLine, { ...basePayload, stream, content: clean });
            },
            (exitCode) => {
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

              socket.emit(EventCommands.TerminalCommandExit, { ...basePayload, exitCode });
              const badge = exitCode === 0 ? '✔ done' : `✖ error (${exitCode})`;
              this.log(`[${terminalName}] [${roomId}] ${badge}: "${content}"`);
            },
            true, // shell
          );
          activeProcesses.set(jobId, proc);
        },
        onConnectError: (_, err) => {
          this.log(
            `[${terminalName}] [${roomId}] Connection failed (${err.message}), retrying...`,
          );
        },
        onDisconnect: (_, reason) => {
          if (reason === 'io server disconnect') {
            if (!this.activeTaskIds.has(taskId)) {
              // Task was deleted — clean exit
              resolve();
            } else {
              this.activeTaskIds.delete(taskId);
              reject(new Error(`[${roomId}] Disconnected: ${reason}`));
            }
          } else {
            this.log(`[${terminalName}] [${roomId}] Disconnected (${reason}), reconnecting...`);
          }
        },
      });
    });
  }
}

