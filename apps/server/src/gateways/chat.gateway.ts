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
  MessageRole,
  SocketAuthSchema,
  createTaskRoomId,
} from '@onezone/shared';
import { AgentRegistryService } from './agent-registry.service';
import { SYSTEM_AGENTS_ROOM } from './constants';
import { Server, Socket } from 'socket.io';
import { TasksService } from '../tasks/tasks.service';
import { AgentsService } from '../agents/agents.service';
import { ChatMessageHandler, ChatMessageData } from './message-handlers/chat-message.handler';
import { OutputLineHandler, OutputLineData } from './message-handlers/output-line.handler';
import { CommandStartHandler, CommandStartData } from './message-handlers/command-start.handler';
import { CommandExitHandler, CommandExitData } from './message-handlers/command-exit.handler';

interface AgentSocketMeta {
  role: 'agent';
  agentId: string;
  agentName: string;
  agentHostname?: string;
  taskId?: string;
}

interface UserSocketMeta {
  role: 'user';
  taskId?: string;
}

type SocketMeta = AgentSocketMeta | UserSocketMeta;

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

  constructor(
    private readonly tasksService: TasksService,
    private readonly agentsService: AgentsService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly chatMessageHandler: ChatMessageHandler,
    private readonly outputLineHandler: OutputLineHandler,
    private readonly commandStartHandler: CommandStartHandler,
    private readonly commandExitHandler: CommandExitHandler,
  ) {}

  afterInit(server: Server): void {
    this.agentRegistry.setServer(server);
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

    const { taskId, role, agentId, agentName, agentHostname } = result.data;

    if (taskId) {
      await this.connectToTaskRoom(client, { taskId, role, agentId, agentName, agentHostname });
    } else {
      await this.connectToLobby(client, { role, agentId, agentName, agentHostname });
    }
  }

  private async connectToTaskRoom(
    client: Socket,
    auth: { taskId: string; role: string; agentId?: string; agentName?: string; agentHostname?: string },
  ): Promise<void> {
    const { taskId, role, agentId, agentName, agentHostname } = auth;

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

    if (role === 'agent' && agentId) {
      this.socketMeta.set(client.id, {
        role: 'agent',
        agentId,
        agentName: agentName ?? agentId,
        agentHostname,
        taskId,
      });

      this.agentRegistry.registerTaskSocket(taskId, client.id);
      await this.agentsService.markConnected(agentId);

      this.server.to(roomId).emit(EventCommands.AgentConnected, {
        agentId,
        agentName: agentName ?? agentId,
        taskId,
        ts: Date.now(),
      });
    } else {
      this.socketMeta.set(client.id, { role: 'user', taskId });

      // Notify newly connected user of already-connected agents in this task
      const ts = Date.now();
      for (const m of this.socketMeta.values()) {
        if (
          m.role === 'agent' &&
          m.taskId === taskId
        ) {
          client.emit('agent:connected', {
            agentId: m.agentId,
            agentName: m.agentName,
            taskId,
            ts,
          });
        }
      }
    }
  }

  private async connectToLobby(
    client: Socket,
    auth: { role: string; agentId?: string; agentName?: string; agentHostname?: string },
  ): Promise<void> {
    const { role, agentId, agentName, agentHostname } = auth;

    await client.join(SYSTEM_AGENTS_ROOM);

    if (role === 'agent' && agentId) {
      this.socketMeta.set(client.id, {
        role: 'agent',
        agentId,
        agentName: agentName ?? agentId,
        agentHostname,
      });

      this.agentRegistry.register(agentId, client.id);
      await this.agentsService.markConnected(agentId);
      this.logger.log(`Agent ${agentId} (${agentName}) joined system lobby`);

      const assignedTasks = await this.tasksService.findByAgent(agentId);
      for (const task of assignedTasks) {
        this.agentRegistry.assignTask(agentId, task.id);
      }
    } else {
      this.socketMeta.set(client.id, { role: 'user' });
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const meta = this.socketMeta.get(client.id);

    if (meta?.role === 'agent') {
      if (meta.taskId) {
        this.agentRegistry.deregisterTaskSocket(meta.taskId, client.id);
        const roomId = createTaskRoomId(meta.taskId);
        this.server.to(roomId).emit(EventCommands.AgentDisconnected, {
          agentId: meta.agentId,
          agentName: meta.agentName,
          taskId: meta.taskId,
          ts: Date.now(),
        });
      } else {
        this.agentRegistry.deregister(meta.agentId);
        await this.agentsService.markDisconnected(meta.agentId);
      }
    }

    this.socketMeta.delete(client.id);
  }

  @SubscribeMessage(EventCommands.AgentHeartbeat)
  async handleAgentHeartbeat(@ConnectedSocket() client: Socket): Promise<void> {
    const meta = this.socketMeta.get(client.id);
    if (meta?.role === 'agent') {
      await this.agentsService.updateHeartbeat(meta.agentId);
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
    return this.outputLineHandler.handle(data, client, this.server);
  }

  @SubscribeMessage('agent:command:start')
  async handleCommandStart(
    @MessageBody() data: CommandStartData,
    @ConnectedSocket() client: Socket,
  ) {
    return this.commandStartHandler.handle(data, client, this.server);
  }

  @SubscribeMessage('agent:command:exit')
  async handleCommandExit(
    @MessageBody() data: CommandExitData,
    @ConnectedSocket() client: Socket,
  ) {
    const meta = this.socketMeta.get(client.id);
    const agentName = meta?.role === 'agent' ? meta.agentName : undefined;
    return this.commandExitHandler.handle({ ...data, agentName }, client, this.server);
  }
}
