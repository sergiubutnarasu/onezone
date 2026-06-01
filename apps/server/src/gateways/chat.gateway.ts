// apps/server/src/gateways/chat.gateway.ts

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SocketAuthGuard } from './socket-auth.guard';
import {
  EventCommands,
  SocketAuthSchema,
  createTaskRoomId,
  createProjectRoomId,
} from '@onezone/shared';
import { TerminalRegistryService } from './terminal-registry.service';
import { SYSTEM_TERMINALS_ROOM } from './constants';
import { Server, Socket } from 'socket.io';
import { TasksService } from '../tasks/tasks.service';
import { TerminalsService } from '../terminals/terminals.service';
import { ProjectsService } from '../projects/projects.service';
import { ChatMessageHandler, ChatMessageData } from './message-handlers/chat-message.handler';
import { OutputLineHandler, OutputLineData } from './message-handlers/output-line.handler';
import { CommandStartHandler, CommandStartData } from './message-handlers/command-start.handler';
import { CommandExitHandler, CommandExitData } from './message-handlers/command-exit.handler';

interface TerminalSocketMeta {
  role: 'terminal';
  userId: string;
  terminalId: string;
  terminalName: string;
  terminalHostname?: string;
  taskId?: string;
}

interface UserSocketMeta {
  role: 'user';
  userId: string;
  taskId?: string;
  projectId?: string;
}

type SocketMeta = TerminalSocketMeta | UserSocketMeta;

@UseGuards(SocketAuthGuard)
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.WEB_ORIGIN || 'http://localhost:5025',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly socketMeta = new Map<string, SocketMeta>();
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly tasksService: TasksService,
    private readonly terminalsService: TerminalsService,
    private readonly projectsService: ProjectsService,
    private readonly terminalRegistry: TerminalRegistryService,
    private readonly chatMessageHandler: ChatMessageHandler,
    private readonly outputLineHandler: OutputLineHandler,
    private readonly commandStartHandler: CommandStartHandler,
    private readonly commandExitHandler: CommandExitHandler,
  ) {}

  afterInit(server: Server): void {
    this.terminalRegistry.setServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const result = SocketAuthSchema.safeParse(client.handshake.auth);

    if (!result.success) {
      this.logger.warn(
        `Socket ${client.id} rejected: invalid auth — ${result.error.message}`,
      );
      client.emit('error', { message: 'Invalid connection parameters' });
      client.disconnect();
      return;
    }

    const { taskId, projectId, role, terminalId, terminalName, terminalHostname } = result.data;
    const userId = this.authenticateConnection(client);

    if (!userId) {
      this.rejectSocket(client, 'Unauthorized');
      return;
    }

    if (taskId) {
      await this.connectToTaskRoom(client, { taskId, role, terminalId, terminalName, terminalHostname, userId });
    } else if (projectId && role === 'user') {
      await this.connectToProjectRoom(client, projectId, userId);
    } else {
      await this.connectToLobby(client, { role, terminalId, terminalName, terminalHostname, userId });
    }
  }

  private authenticateConnection(client: Socket): string | null {
    const existingUserId = client.data.userId as string | undefined;
    if (existingUserId) return existingUserId;

    const token = this.extractToken(client);
    if (!token) return null;

    try {
      const payload = this.jwt.verify(token) as { sub: string; email: string };
      client.data.userId = payload.sub;
      return payload.sub;
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken?.startsWith('Bearer ')) return authToken.slice(7);
    if (authToken) return authToken;

    const cookieHeader = client.handshake.headers.cookie ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private rejectSocket(client: Socket, message: string): void {
    client.emit('error', { message });
    client.disconnect();
  }

  private rejectEvent(client: Socket, message: string): { status: 'error' } {
    client.emit('error', { message });
    return { status: 'error' };
  }

  private getAuthorizedTaskId(
    client: Socket,
    roomId: string,
    role: 'user' | 'terminal',
  ): string | null {
    const taskId = roomId.startsWith('task:') ? roomId.slice('task:'.length) : '';
    const meta = this.socketMeta.get(client.id);

    if (!taskId || roomId !== createTaskRoomId(taskId)) {
      this.rejectEvent(client, 'Invalid task room');
      return null;
    }

    if (!meta || meta.role !== role || meta.taskId !== taskId) {
      this.rejectEvent(client, 'Unauthorized task room');
      return null;
    }

    if (meta.userId !== (client.data as { userId?: string }).userId) {
      this.rejectEvent(client, 'Unauthorized');
      return null;
    }

    return taskId;
  }

  private async connectToTaskRoom(
    client: Socket,
    auth: { taskId: string; role: string; terminalId?: string; terminalName?: string; terminalHostname?: string; userId: string },
  ): Promise<void> {
    const { taskId, role, terminalId, terminalName, terminalHostname, userId } = auth;
    let task: Awaited<ReturnType<TasksService['findOne']>>;

    try {
      task = await this.tasksService.findOne(taskId, userId);
      if (role === 'terminal' && task.completedAt) {
        this.logger.log(`Terminal socket ${client.id} skipped completed task ${taskId}`);
        this.rejectSocket(client, 'Task is completed');
        return;
      }
    } catch (error) {
      this.logger.warn(`Socket ${client.id} rejected: task ${taskId} not found`, error);
      this.rejectSocket(client, 'Task not found');
      return;
    }

    if (role === 'terminal') {
      if (!terminalId) {
        this.rejectSocket(client, 'Terminal id is required');
        return;
      }
      try {
        await this.terminalsService.findOne(terminalId, userId);
      } catch (error) {
        this.logger.warn(`Socket ${client.id} rejected: terminal ${terminalId} not found`, error);
        this.rejectSocket(client, 'Terminal not found');
        return;
      }
      const assignedTerminalId = (task.terminal as { id?: string } | null)?.id;
      if (assignedTerminalId !== terminalId) {
        this.rejectSocket(client, 'Terminal is not assigned to task');
        return;
      }
    }

    const roomId = createTaskRoomId(taskId);
    await client.join(roomId);

    if (role === 'terminal' && terminalId) {
      this.socketMeta.set(client.id, {
        role: 'terminal',
        userId,
        terminalId,
        terminalName: terminalName ?? terminalId,
        terminalHostname,
        taskId,
      });

      // Cancel any pending markDisconnected from a recent disconnect/reconnect cycle
      const pendingTimer = this.disconnectTimers.get(terminalId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        this.disconnectTimers.delete(terminalId);
      }

      this.terminalRegistry.registerTaskSocket(taskId, client.id);
      await this.terminalsService.markConnected(terminalId, userId);

      this.server.to(roomId).emit(EventCommands.TerminalConnected, {
        terminalId,
        terminalName: terminalName ?? terminalId,
        taskId,
        ts: Date.now(),
      });
    } else {
      this.socketMeta.set(client.id, { role: 'user', userId, taskId });

      // Notify newly connected user of already-connected terminals in this task
      const ts = Date.now();
      for (const m of this.socketMeta.values()) {
        if (
          m.role === 'terminal' &&
          m.taskId === taskId
        ) {
          client.emit('terminal:connected', {
            terminalId: m.terminalId,
            terminalName: m.terminalName,
            taskId,
            ts,
          });
        }
      }
    }
  }

  private async connectToProjectRoom(client: Socket, projectId: string, userId: string): Promise<void> {
    try {
      await this.projectsService.findOne(projectId, userId);
    } catch (error) {
      this.logger.warn(`Socket ${client.id} rejected: project ${projectId} not found`, error);
      this.rejectSocket(client, 'Project not found');
      return;
    }
    const roomId = createProjectRoomId(projectId);
    await client.join(roomId);
    this.socketMeta.set(client.id, { role: 'user', userId, projectId });
  }

  private async connectToLobby(
    client: Socket,
    auth: { role: string; terminalId?: string; terminalName?: string; terminalHostname?: string; userId: string },
  ): Promise<void> {
    const { role, terminalId, terminalName, terminalHostname, userId } = auth;

    if (role === 'terminal') {
      if (!terminalId) {
        this.rejectSocket(client, 'Terminal id is required');
        return;
      }
      try {
        await this.terminalsService.findOne(terminalId, userId);
      } catch (error) {
        this.logger.warn(`Socket ${client.id} rejected: terminal ${terminalId} not found`, error);
        this.rejectSocket(client, 'Terminal not found');
        return;
      }
      // Set meta before any await so hasTerminalAnyConnection() sees this socket
      // immediately, even if a deferred disconnect timer fires during client.join().
      this.socketMeta.set(client.id, {
        role: 'terminal',
        userId,
        terminalId,
        terminalName: terminalName ?? terminalId,
        terminalHostname,
      });
    }

    await client.join(SYSTEM_TERMINALS_ROOM);

    if (role === 'terminal' && terminalId) {
      // Cancel any pending markDisconnected from a recent disconnect/reconnect cycle
      const pendingTimer = this.disconnectTimers.get(terminalId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        this.disconnectTimers.delete(terminalId);
      }

      this.terminalRegistry.register(terminalId, client.id);
      await this.terminalsService.markConnected(terminalId, userId);
      this.logger.log(`Terminal ${terminalId} (${terminalName}) joined system lobby`);

      const assignedTasks = await this.tasksService.findByTerminal(terminalId);
      for (const task of assignedTasks) {
        this.terminalRegistry.assignTask(terminalId, task);
      }
    } else {
      this.socketMeta.set(client.id, { role: 'user', userId });
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const meta = this.socketMeta.get(client.id);

    if (meta?.role === 'terminal') {
      const { terminalId, taskId } = meta;

      if (taskId) {
        this.terminalRegistry.deregisterTaskSocket(taskId, client.id);
      } else {
        this.terminalRegistry.deregister(terminalId);

        // Defer markDisconnected so a fast reconnect's markConnected can cancel it,
        // preventing a race where markDisconnected commits after markConnected.
        const timer = setTimeout(async () => {
          this.disconnectTimers.delete(terminalId);
          if (!this.hasTerminalAnyConnection(terminalId, client.id)) {
            await this.terminalsService.markDisconnected(terminalId, meta.userId);
          }
        }, 2000);
        this.disconnectTimers.set(terminalId, timer);

        this.socketMeta.delete(client.id);
        return;
      }

      // Defer markDisconnected so a fast reconnect's markConnected can cancel it,
      // preventing a race where markDisconnected commits after markConnected.
      const pendingTimer = this.disconnectTimers.get(terminalId);
      if (pendingTimer) clearTimeout(pendingTimer);
      const disconnectedSocketId = client.id;
      const timer = setTimeout(async () => {
        this.disconnectTimers.delete(terminalId);
        if (!this.hasTerminalAnyConnection(terminalId, disconnectedSocketId)) {
          await this.terminalsService.markDisconnected(terminalId, meta.userId);
          if (taskId) {
            this.server.to(createTaskRoomId(taskId)).emit(EventCommands.TerminalDisconnected, {
              terminalId,
              terminalName: meta.terminalName,
              taskId,
              ts: Date.now(),
            });
          }
        }
      }, 2000);
      this.disconnectTimers.set(terminalId, timer);
    }

    this.socketMeta.delete(client.id);
  }

  /**
   * Checks if a terminal has any active socket connections (lobby or task room)
   * excluding the specified socket ID.
   */
  private hasTerminalAnyConnection(terminalId: string, excludeSocketId: string): boolean {
    for (const [socketId, socketMeta] of this.socketMeta.entries()) {
      if (socketId !== excludeSocketId && 
          socketMeta.role === 'terminal' && 
          socketMeta.terminalId === terminalId) {
        return true;
      }
    }
    return false;
  }

  @SubscribeMessage(EventCommands.TerminalHeartbeat)
  async handleTerminalHeartbeat(@ConnectedSocket() client: Socket): Promise<void> {
    const meta = this.socketMeta.get(client.id);
    if (meta?.role === 'terminal') {
      await this.terminalsService.updateHeartbeat(meta.terminalId, meta.userId);
    }
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @MessageBody() data: ChatMessageData,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.getAuthorizedTaskId(client, data.roomId, 'user')) {
      return { status: 'error' };
    }
    return this.chatMessageHandler.handle(data, client, this.server, (client.data as { userId?: string }).userId);
  }

  @SubscribeMessage('output:line')
  async handleOutputLine(
    @MessageBody() data: OutputLineData,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.getAuthorizedTaskId(client, data.roomId, 'terminal')) {
      return { status: 'error' };
    }
    const meta = this.socketMeta.get(client.id);
    const terminalId = meta?.role === 'terminal' ? meta.terminalId : undefined;
    const terminalName = meta?.role === 'terminal' ? meta.terminalName : undefined;
    return this.outputLineHandler.handle({ ...data, terminalId, terminalName }, client, this.server, (client.data as { userId?: string }).userId);
  }

  @SubscribeMessage('terminal:command:start')
  async handleCommandStart(
    @MessageBody() data: CommandStartData,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.getAuthorizedTaskId(client, data.roomId, 'terminal')) {
      return { status: 'error' };
    }
    const meta = this.socketMeta.get(client.id);
    const terminalId = meta?.role === 'terminal' ? meta.terminalId : undefined;
    const terminalName = meta?.role === 'terminal' ? meta.terminalName : undefined;
    return this.commandStartHandler.handle({ ...data, terminalId, terminalName }, client, this.server, (client.data as { userId?: string }).userId);
  }

  @SubscribeMessage('terminal:command:exit')
  async handleCommandExit(
    @MessageBody() data: CommandExitData,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.getAuthorizedTaskId(client, data.roomId, 'terminal')) {
      return { status: 'error' };
    }
    const meta = this.socketMeta.get(client.id);
    const terminalId = meta?.role === 'terminal' ? meta.terminalId : undefined;
    const terminalName = meta?.role === 'terminal' ? meta.terminalName : undefined;
    return this.commandExitHandler.handle({ ...data, terminalId, terminalName }, client, this.server, (client.data as { userId?: string }).userId);
  }

  @SubscribeMessage(EventCommands.TerminalCommandStop)
  handleCommandStop(
    @MessageBody() data: { jobId: string; taskId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const meta = this.socketMeta.get(client.id);
    if (meta?.role !== 'user' || meta.taskId !== data.taskId) return;
    this.terminalRegistry.forwardStopCommandToTerminal(data.taskId, data.jobId);
  }
}
