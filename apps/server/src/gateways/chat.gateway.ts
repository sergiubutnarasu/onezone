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
import { SocketAuthGuard } from './socket-auth.guard';
import {
  EventCommands,
  SocketAuthSchema,
  createTaskRoomId,
} from '@onezone/shared';
import { TerminalRegistryService } from './terminal-registry.service';
import { SYSTEM_TERMINALS_ROOM } from './constants';
import { Server, Socket } from 'socket.io';
import { TasksService } from '../tasks/tasks.service';
import { TerminalsService } from '../terminals/terminals.service';
import { ChatMessageHandler, ChatMessageData } from './message-handlers/chat-message.handler';
import { OutputLineHandler, OutputLineData } from './message-handlers/output-line.handler';
import { CommandStartHandler, CommandStartData } from './message-handlers/command-start.handler';
import { CommandExitHandler, CommandExitData } from './message-handlers/command-exit.handler';

interface TerminalSocketMeta {
  role: 'terminal';
  terminalId: string;
  terminalName: string;
  terminalHostname?: string;
  taskId?: string;
}

interface UserSocketMeta {
  role: 'user';
  taskId?: string;
}

type SocketMeta = TerminalSocketMeta | UserSocketMeta;

@UseGuards(SocketAuthGuard)
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5025',
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
    private readonly tasksService: TasksService,
    private readonly terminalsService: TerminalsService,
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

    const { taskId, role, terminalId, terminalName, terminalHostname } = result.data;

    if (taskId) {
      await this.connectToTaskRoom(client, { taskId, role, terminalId, terminalName, terminalHostname });
    } else {
      await this.connectToLobby(client, { role, terminalId, terminalName, terminalHostname });
    }
  }

  private async connectToTaskRoom(
    client: Socket,
    auth: { taskId: string; role: string; terminalId?: string; terminalName?: string; terminalHostname?: string },
  ): Promise<void> {
    const { taskId, role, terminalId, terminalName, terminalHostname } = auth;

    try {
      await this.tasksService.findOne(taskId);
    } catch (error) {
      this.logger.warn(`Socket ${client.id} rejected: task ${taskId} not found`, error);
      client.emit('error', { message: 'Task not found' });
      client.disconnect();
      return;
    }

    const roomId = createTaskRoomId(taskId);
    await client.join(roomId);

    if (role === 'terminal' && terminalId) {
      this.socketMeta.set(client.id, {
        role: 'terminal',
        terminalId,
        terminalName: terminalName ?? terminalId,
        terminalHostname,
        taskId,
      });

      this.terminalRegistry.registerTaskSocket(taskId, client.id);
      await this.terminalsService.markConnected(terminalId);

      this.server.to(roomId).emit(EventCommands.TerminalConnected, {
        terminalId,
        terminalName: terminalName ?? terminalId,
        taskId,
        ts: Date.now(),
      });
    } else {
      this.socketMeta.set(client.id, { role: 'user', taskId });

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

  private async connectToLobby(
    client: Socket,
    auth: { role: string; terminalId?: string; terminalName?: string; terminalHostname?: string },
  ): Promise<void> {
    const { role, terminalId, terminalName, terminalHostname } = auth;

    if (role === 'terminal' && terminalId) {
      // Set meta before any await so hasTerminalAnyConnection() sees this socket
      // immediately, even if a deferred disconnect timer fires during client.join().
      this.socketMeta.set(client.id, {
        role: 'terminal',
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
      await this.terminalsService.markConnected(terminalId);
      this.logger.log(`Terminal ${terminalId} (${terminalName}) joined system lobby`);

      const assignedTasks = await this.tasksService.findByTerminal(terminalId);
      for (const task of assignedTasks) {
        this.terminalRegistry.assignTask(terminalId, task.id);
      }
    } else {
      this.socketMeta.set(client.id, { role: 'user' });
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const meta = this.socketMeta.get(client.id);

    if (meta?.role === 'terminal') {
      const { terminalId, taskId } = meta;

      if (taskId) {
        this.terminalRegistry.deregisterTaskSocket(taskId, client.id);
        const roomId = createTaskRoomId(taskId);
        this.server.to(roomId).emit(EventCommands.TerminalDisconnected, {
          terminalId,
          terminalName: meta.terminalName,
          taskId,
          ts: Date.now(),
        });
      } else {
        this.terminalRegistry.deregister(terminalId);

        // Defer markDisconnected so a fast reconnect's markConnected can cancel it,
        // preventing a race where markDisconnected commits after markConnected.
        const timer = setTimeout(async () => {
          this.disconnectTimers.delete(terminalId);
          if (!this.hasTerminalAnyConnection(terminalId, client.id)) {
            await this.terminalsService.markDisconnected(terminalId);
          }
        }, 2000);
        this.disconnectTimers.set(terminalId, timer);

        this.socketMeta.delete(client.id);
        return;
      }

      // Task-room terminal: no reconnect race, mark disconnected immediately
      const hasOtherConnection = this.hasTerminalAnyConnection(terminalId, client.id);
      if (!hasOtherConnection) {
        await this.terminalsService.markDisconnected(terminalId);
      }
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
      await this.terminalsService.updateHeartbeat(meta.terminalId);
    }
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @MessageBody() data: ChatMessageData,
    @ConnectedSocket() client: Socket,
  ) {
    return this.chatMessageHandler.handle(data, client, this.server);
  }

  @SubscribeMessage('output:line')
  async handleOutputLine(
    @MessageBody() data: OutputLineData,
    @ConnectedSocket() client: Socket,
  ) {
    const meta = this.socketMeta.get(client.id);
    const terminalId = meta?.role === 'terminal' ? meta.terminalId : undefined;
    const terminalName = meta?.role === 'terminal' ? meta.terminalName : undefined;
    return this.outputLineHandler.handle({ ...data, terminalId, terminalName }, client, this.server);
  }

  @SubscribeMessage('terminal:command:start')
  async handleCommandStart(
    @MessageBody() data: CommandStartData,
    @ConnectedSocket() client: Socket,
  ) {
    const meta = this.socketMeta.get(client.id);
    const terminalId = meta?.role === 'terminal' ? meta.terminalId : undefined;
    const terminalName = meta?.role === 'terminal' ? meta.terminalName : undefined;
    return this.commandStartHandler.handle({ ...data, terminalId, terminalName }, client, this.server);
  }

  @SubscribeMessage('terminal:command:exit')
  async handleCommandExit(
    @MessageBody() data: CommandExitData,
    @ConnectedSocket() client: Socket,
  ) {
    const meta = this.socketMeta.get(client.id);
    const terminalId = meta?.role === 'terminal' ? meta.terminalId : undefined;
    const terminalName = meta?.role === 'terminal' ? meta.terminalName : undefined;
    return this.commandExitHandler.handle({ ...data, terminalId, terminalName }, client, this.server);
  }
}
