import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service';
import { TasksService } from '../tasks/tasks.service';

interface AgentSocketMeta {
  taskId: string;
  role: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5025',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // Track agent metadata by socket id
  private socketMeta = new Map<string, AgentSocketMeta>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly tasksService: TasksService,
  ) {}

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as {
      taskId?: string;
      role?: string;
      agentId?: string;
      agentName?: string;
    };

    const taskId = auth?.taskId;
    const role = (auth?.role as 'user' | 'agent') || 'user';

    if (!taskId) {
      client.disconnect();
      return;
    }

    // Validate task exists
    try {
      await this.tasksService.findOne(taskId);
    } catch {
      client.disconnect();
      return;
    }

    const roomId = `task:${taskId}`;
    await client.join(roomId);

    const meta: AgentSocketMeta = {
      taskId,
      role,
      agentId: auth.agentId,
      agentName: auth.agentName,
    };
    this.socketMeta.set(client.id, meta);

    if (role === 'agent' && auth.agentId) {
      this.server.to(roomId).emit('agent:connected', {
        agentId: auth.agentId,
        agentName: auth.agentName || auth.agentId,
        taskId,
        ts: Date.now(),
      });
    }
  }

  async handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (meta && meta.role === 'agent' && meta.agentId) {
      const roomId = `task:${meta.taskId}`;
      this.server.to(roomId).emit('agent:disconnected', {
        agentId: meta.agentId,
        agentName: meta.agentName || meta.agentId,
        taskId: meta.taskId,
        ts: Date.now(),
      });
    }
    this.socketMeta.delete(client.id);
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const taskId = data.roomId.replace('task:', '');
    const ts = Date.now();

    const message = await this.messagesService.create({
      roomId: data.roomId,
      taskId,
      role: 'user',
      content: data.content,
      ts,
    });

    this.server.to(data.roomId).emit('chat:message', { ...message, ts: Number(message.ts) });
    return { status: 'ok' };
  }

  @SubscribeMessage('output:line')
  async handleOutputLine(
    @MessageBody()
    data: {
      roomId: string;
      agentId: string;
      agentName: string;
      jobId?: string;
      command?: string;
      stream: 'stdout' | 'stderr';
      content: string;
    },
  ) {
    const taskId = data.roomId.replace('task:', '');
    const ts = Date.now();

    const message = await this.messagesService.create({
      roomId: data.roomId,
      taskId,
      role: 'agent',
      agentId: data.agentId,
      agentName: data.agentName,
      jobId: data.jobId,
      command: data.command,
      stream: data.stream,
      content: data.content,
      ts,
    });

    this.server.to(data.roomId).emit('output:line', { ...message, ts: Number(message.ts) });
    return { status: 'ok' };
  }

  @SubscribeMessage('agent:connected')
  handleAgentConnected(
    @MessageBody() data: { roomId: string; agentId: string; agentName: string },
  ) {
    this.server.to(data.roomId).emit('agent:connected', {
      agentId: data.agentId,
      agentName: data.agentName,
      taskId: data.roomId.replace('task:', ''),
      ts: Date.now(),
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('agent:command:start')
  async handleCommandStart(
    @MessageBody()
    data: { roomId: string; agentId: string; agentName: string; jobId: string; command: string },
  ) {
    const taskId = data.roomId.replace('task:', '');
    const ts = Date.now();

    await this.messagesService.create({
      roomId: data.roomId,
      taskId,
      role: 'system',
      agentId: data.agentId,
      agentName: data.agentName,
      jobId: data.jobId,
      command: data.command,
      content: `[${data.agentName}] started: ${data.command}`,
      ts,
    });

    this.server.to(data.roomId).emit('agent:command:start', {
      agentId: data.agentId,
      agentName: data.agentName,
      jobId: data.jobId,
      command: data.command,
      ts,
    });
    return { status: 'ok' };
  }

  @SubscribeMessage('agent:command:exit')
  async handleCommandExit(
    @MessageBody()
    data: { roomId: string; agentId: string; jobId: string; command: string; exitCode: number },
  ) {
    const taskId = data.roomId.replace('task:', '');
    const ts = Date.now();

    const meta = [...this.socketMeta.values()].find(
      (m) => m.agentId === data.agentId,
    );

    await this.messagesService.create({
      roomId: data.roomId,
      taskId,
      role: 'system',
      agentId: data.agentId,
      agentName: meta?.agentName,
      jobId: data.jobId,
      command: data.command,
      content: `[${data.agentId}] exited with code ${data.exitCode}: ${data.command}`,
      ts,
    });

    this.server.to(data.roomId).emit('agent:command:exit', {
      agentId: data.agentId,
      jobId: data.jobId,
      command: data.command,
      exitCode: data.exitCode,
      ts,
    });
    return { status: 'ok' };
  }
}
