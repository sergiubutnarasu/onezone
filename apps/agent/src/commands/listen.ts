// apps/agent/src/commands/listen.ts

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
import { registerAgent } from '../lib/agent-registration.js';
import { createLobbySocket, createTaskSocket } from '../lib/task-socket.js';

export default class Listen extends Command {
  private readonly activeTaskIds = new Set<string>();

  static description =
    'Connect to a task room (or wait for one to be assigned) and stay open, spawning commands as users send messages in the chat';

  static examples = [
    '<%= config.bin %> listen',
    '<%= config.bin %> listen --task <taskId>',
    '<%= config.bin %> listen --task <taskId1> --task <taskId2>',
    '<%= config.bin %> listen --task <taskId> --name my-agent',
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
      description: 'Agent name — must be unique across all running agents',
      default: hostname(),
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Listen);

    const agentName = flags.name;
    const taskIds = flags.task;

    let agentId: string;
    try {
      agentId = await registerAgent({ serverUrl: flags.server, name: agentName });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    this.log(`[${agentName}] Agent ID: ${agentId}`);

    registerCleanupHandlers();

    const connections: Promise<void>[] = [
      this.connectToLobby(flags.server, agentId, agentName),
    ];

    if (taskIds?.length) {
      for (const taskId of taskIds) {
        this.activeTaskIds.add(taskId);
      }
      connections.push(
        ...taskIds.map((taskId) =>
          this.connectToTask(flags.server, taskId, agentId, agentName),
        ),
      );
    }

    await Promise.all(connections);
  }

  private connectToLobby(
    serverUrl: string,
    agentId: string,
    agentName: string,
  ): Promise<void> {
    return new Promise<void>((_, reject) => {
      createLobbySocket(serverUrl, agentId, agentName, {
        onConnect: () => {
          this.log(`[${agentName}] Connected to ${serverUrl} | Waiting for task assignment...`);
        },
        onMessage: (event, payload) => {
          if (event === EventCommands.AssignTask) {
            const { taskId } = payload as AssignTaskPayload;
            if (this.activeTaskIds.has(taskId)) {
              this.log(`[${agentName}] Already connected to task: ${taskId}, skipping`);
              return;
            }
            this.log(`[${agentName}] Assigned to task: ${taskId}`);
            this.activeTaskIds.add(taskId);
            this.connectToTask(serverUrl, taskId, agentId, agentName).catch((err: Error) => {
              this.activeTaskIds.delete(taskId);
              this.log(`[${agentName}] Task ${taskId} connection failed: ${err.message}`);
            });
          }
        },
        onConnectError: (_, err) => {
          this.log(`[${agentName}] Lobby connection failed (${err.message}), retrying...`);
        },
        onDisconnect: (_, reason) => {
          if (reason === 'io server disconnect') {
            reject(new Error(`Lobby disconnected: ${reason}`));
          } else {
            this.log(`[${agentName}] Lobby disconnected (${reason}), reconnecting...`);
          }
        },
      });
    });
  }

  private connectToTask(
    serverUrl: string,
    taskId: string,
    agentId: string,
    agentName: string,
  ): Promise<void> {
    const roomId = createTaskRoomId(taskId);

    return new Promise<void>((resolve, reject) => {
      const activeProcesses = new Map<string, ReturnType<typeof runProcess>>();

      const { socket } = createTaskSocket(serverUrl, taskId, agentId, agentName, {
        onConnect: () => {
          this.log(
            `[${agentName}] Connected to ${serverUrl} | room: ${roomId} | Listening for commands...`,
          );
        },
        onMessage: (event, payload) => {
          if (event === EventCommands.TaskDeleted) {
            this.log(`[${agentName}] [${roomId}] Task deleted, disconnecting...`);
            this.activeTaskIds.delete(taskId);
            return;
          }
          if (event !== EventCommands.ChatMessage) return;
          const message = payload as ChatMessage;
          if (message.role !== MessageRole.User) return;

          const content = message.content.trim();
          if (!content) return;

          this.log(`[${agentName}] [${roomId}] Spawning: ${content}`);

          const jobId = randomUUID();
          const basePayload = { roomId, agentId, agentName, jobId, command: content };

          socket.emit(EventCommands.AgentCommandStart, basePayload);

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

              socket.emit(EventCommands.AgentCommandExit, { ...basePayload, exitCode });
              const badge = exitCode === 0 ? '✔ done' : `✖ error (${exitCode})`;
              this.log(`[${agentName}] [${roomId}] ${badge}: "${content}"`);
            },
            true, // shell
          );
          activeProcesses.set(jobId, proc);
        },
        onConnectError: (_, err) => {
          this.log(
            `[${agentName}] [${roomId}] Connection failed (${err.message}), retrying...`,
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
            this.log(`[${agentName}] [${roomId}] Disconnected (${reason}), reconnecting...`);
          }
        },
      });
    });
  }
}
