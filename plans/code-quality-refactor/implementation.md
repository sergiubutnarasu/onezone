# Code Quality & SOLID Refactoring

## Goal
Improve type safety, eliminate code duplication, decompose god classes, and enforce SOLID principles across shared types, server gateway, agent CLI, and web frontend.

## Prerequisites
Make sure you are currently on the `refactor/code-quality-solid` branch before beginning implementation.
If not, move to the correct branch. If the branch does not exist, create it from main:

```bash
git checkout main && git pull
git checkout -b refactor/code-quality-solid
```

---

### Step-by-Step Instructions

#### Step 1: Foundation — Type Safety & Protocol Constants

- [x] Create `packages/shared/src/constants.ts` with the content below:

```typescript
// packages/shared/src/constants.ts

/** Heartbeat interval for agent → server keep-alive pings. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Agents are considered stale (disconnected) if no heartbeat is received
 * within this window. Must be greater than HEARTBEAT_INTERVAL_MS.
 */
export const STALE_THRESHOLD_MS = 90_000;

/** Constructs the socket room ID for a given task. */
export function createTaskRoomId(taskId: string): string {
  return `task:${taskId}`;
}

/** Extracts the taskId from a task room ID. */
export function extractTaskId(roomId: string): string {
  return roomId.replace('task:', '');
}
```

- [x] Replace `packages/shared/src/types.ts` with the content below (adds `RoomMessage` discriminated union while keeping all existing exports):

```typescript
// packages/shared/src/types.ts

export enum EventCommands {
  ChatMessage = "chat:message",
  OutputLine = "output:line",
  AgentConnected = "agent:connected",
  AgentDisconnected = "agent:disconnected",
  AgentCommandStart = "agent:command:start",
  AgentCommandExit = "agent:command:exit",
  AgentHeartbeat = "agent:heartbeat",
  AssignTask = "agent:assign-task",
}

export enum MessageRole {
  User = "user",
  Agent = "agent",
  System = "system",
}

export enum MessageStream {
  Stdout = "stdout",
  Stderr = "stderr",
}

export enum MessageType {
  CommandStart = "COMMAND_START",
  CommandExit = "COMMAND_EXIT",
}

export enum TaskStatus {
  BACKLOG = "BACKLOG",
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  TESTING = "TESTING",
  DONE = "DONE",
}

export const TASK_STATUS_COLUMNS = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.TESTING,
  TaskStatus.DONE,
] as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "Backlog",
  [TaskStatus.TODO]: "To Do",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.IN_REVIEW]: "In Review",
  [TaskStatus.TESTING]: "Testing",
  [TaskStatus.DONE]: "Done",
};

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  status: TaskStatus;
  order: number;
  agentId?: string | null;
  createdAt: string;
}

export interface AssignTaskPayload {
  agentId: string;
  taskId: string;
}

export interface Agent {
  id: string;
  name: string;
  hostname: string;
  isConnected: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

// --- Chat message ---

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// --- Socket event payloads ---

export interface CommandStartPayload {
  roomId: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
}

export interface OutputLinePayload {
  roomId: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
  stream: MessageStream;
  content: string;
}

export interface CommandExitPayload {
  roomId: string;
  agentId: string;
  jobId: string;
  command: string;
  exitCode: number;
}

// --- Typed socket event maps ---

export interface ServerToClientEvents {
  [EventCommands.ChatMessage]: (message: ChatMessage) => void;
  [EventCommands.AgentConnected]: (payload: {
    agentId: string;
    agentName: string;
  }) => void;
  [EventCommands.AgentDisconnected]: (payload: { agentId: string }) => void;
  [EventCommands.AssignTask]: (payload: AssignTaskPayload) => void;
}

export interface ClientToServerEvents {
  [EventCommands.AgentCommandStart]: (payload: CommandStartPayload) => void;
  [EventCommands.OutputLine]: (payload: OutputLinePayload) => void;
  [EventCommands.AgentCommandExit]: (payload: CommandExitPayload) => void;
  [EventCommands.AgentHeartbeat]: () => void;
}

// --- Discriminated union for room messages (used by web frontend) ---

interface BaseRoomMessage {
  id?: string;
  roomId: string;
  ts: number;
}

export interface UserChatMessage extends BaseRoomMessage {
  role: 'user';
  content: string;
  agentId?: null;
  agentName?: null;
  jobId?: null;
  command?: null;
  stream?: null;
  exitCode?: null;
  messageType?: null;
}

export interface AgentOutputMessage extends BaseRoomMessage {
  role: 'agent';
  content: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
  stream: 'stdout' | 'stderr';
  exitCode?: null;
  messageType?: null;
}

export interface CommandStartMessage extends BaseRoomMessage {
  role: 'system';
  messageType: MessageType.CommandStart;
  content: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
  stream?: null;
  exitCode?: null;
}

export interface CommandExitMessage extends BaseRoomMessage {
  role: 'system';
  messageType?: MessageType.CommandExit | null;
  content: string;
  agentId: string;
  agentName?: string | null;
  jobId: string;
  command: string;
  exitCode: number;
  stream?: null;
}

export interface SystemNoticeMessage extends BaseRoomMessage {
  role: 'system';
  content: string;
  agentId?: string | null;
  agentName?: string | null;
  jobId?: null;
  command?: null;
  stream?: null;
  exitCode?: null;
  messageType?: null;
}

export type RoomMessage =
  | UserChatMessage
  | AgentOutputMessage
  | CommandStartMessage
  | CommandExitMessage
  | SystemNoticeMessage;
```

- [x] Replace `packages/shared/src/schemas.ts` with the content below (adds `baseEntitySchema` to eliminate Zod duplication):

```typescript
// packages/shared/src/schemas.ts

import { z } from 'zod';

const baseEntitySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const CreateProjectSchema = baseEntitySchema;

export const CreateTaskSchema = baseEntitySchema;

export const SocketAuthSchema = z.object({
  taskId: z.string().uuid().optional(),
  role: z.enum(['user', 'agent']),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
  agentHostname: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type SocketAuthInput = z.infer<typeof SocketAuthSchema>;
```

- [x] Replace `packages/shared/src/index.ts` with the content below (exports the new constants file):

```typescript
// packages/shared/src/index.ts

export * from './types';
export * from './schemas';
export * from './constants';
```

- [x] Run the build to confirm the shared package compiles:

```bash
cd /Users/sergiu/Projects/personal/onezone
pnpm --filter @onezone/shared build
```

##### Step 1 Verification Checklist
- [x] `pnpm --filter @onezone/shared build` exits with code 0
- [x] `dist/` folder exists under `packages/shared/`
- [x] Type errors will appear in `apps/server`, `apps/agent`, and `apps/web` — this is expected and will be resolved in subsequent steps

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 2: Server — Decompose ChatGateway

- [x] Create `apps/server/src/gateways/socket-auth.guard.ts`:

```typescript
// apps/server/src/gateways/socket-auth.guard.ts

import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { SocketAuthSchema } from '@onezone/shared';
import { Socket } from 'socket.io';

@Injectable()
export class SocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(SocketAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const result = SocketAuthSchema.safeParse(client.handshake.auth);

    if (!result.success) {
      this.logger.warn(
        `Socket ${client.id} rejected: invalid auth — ${result.error.message}`,
      );
      client.emit('error', { message: 'Invalid connection parameters' });
      client.disconnect();
      return false;
    }

    // Attach parsed data to the socket for downstream use
    (client as Socket & { parsedAuth: typeof result.data }).parsedAuth = result.data;
    return true;
  }
}
```

- [x] Create `apps/server/src/gateways/message-handlers/message-handler.interface.ts`:

```typescript
// apps/server/src/gateways/message-handlers/message-handler.interface.ts

import { Socket } from 'socket.io';

export interface IMessageHandler<T = unknown> {
  handle(data: T, client: Socket): Promise<{ status: 'ok' | 'error' }>;
}
```

- [x] Create `apps/server/src/gateways/message-handlers/chat-message.handler.ts`:

```typescript
// apps/server/src/gateways/message-handlers/chat-message.handler.ts

import { Injectable, Logger } from '@nestjs/common';
import { MessageRole } from '@onezone/shared';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { extractTaskId } from '@onezone/shared';
import { IMessageHandler } from './message-handler.interface';

export interface ChatMessageData {
  roomId: string;
  content: string;
}

@Injectable()
export class ChatMessageHandler implements IMessageHandler<ChatMessageData> {
  private readonly logger = new Logger(ChatMessageHandler.name);

  constructor(private readonly messagesService: MessagesService) {}

  async handle(
    data: ChatMessageData,
    client: Socket,
    server?: Server,
  ): Promise<{ status: 'ok' | 'error' }> {
    try {
      const taskId = extractTaskId(data.roomId);
      const ts = Date.now();

      const message = await this.messagesService.create({
        roomId: data.roomId,
        taskId,
        role: MessageRole.User,
        content: data.content,
        ts,
      });

      server
        ?.to(data.roomId)
        .emit('chat:message', { ...message, ts: Number(message.ts) });

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle chat:message', error);
      client.emit('error', { message: 'Failed to save message' });
      return { status: 'error' };
    }
  }
}
```

- [x] Create `apps/server/src/gateways/message-handlers/output-line.handler.ts`:

```typescript
// apps/server/src/gateways/message-handlers/output-line.handler.ts

import { Injectable, Logger } from '@nestjs/common';
import { MessageRole, MessageStream } from '@onezone/shared';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { extractTaskId } from '@onezone/shared';
import { IMessageHandler } from './message-handler.interface';

export interface OutputLineData {
  roomId: string;
  agentId: string;
  agentName: string;
  jobId?: string;
  command?: string;
  stream: MessageStream;
  content: string;
}

@Injectable()
export class OutputLineHandler implements IMessageHandler<OutputLineData> {
  private readonly logger = new Logger(OutputLineHandler.name);

  constructor(private readonly messagesService: MessagesService) {}

  async handle(
    data: OutputLineData,
    client: Socket,
    server?: Server,
  ): Promise<{ status: 'ok' | 'error' }> {
    try {
      const taskId = extractTaskId(data.roomId);
      const ts = Date.now();

      const message = await this.messagesService.create({
        roomId: data.roomId,
        taskId,
        role: MessageRole.Agent,
        agentId: data.agentId,
        agentName: data.agentName,
        jobId: data.jobId,
        command: data.command,
        stream: data.stream,
        content: data.content,
        ts,
      });

      server
        ?.to(data.roomId)
        .emit('output:line', { ...message, ts: Number(message.ts) });

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle output:line', error);
      client.emit('error', { message: 'Failed to save output line' });
      return { status: 'error' };
    }
  }
}
```

- [x] Create `apps/server/src/gateways/message-handlers/command-start.handler.ts`:

```typescript
// apps/server/src/gateways/message-handlers/command-start.handler.ts

import { Injectable, Logger } from '@nestjs/common';
import { EventCommands, MessageRole } from '@onezone/shared';
import { MessageType } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { extractTaskId } from '@onezone/shared';
import { IMessageHandler } from './message-handler.interface';

export interface CommandStartData {
  roomId: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
}

@Injectable()
export class CommandStartHandler implements IMessageHandler<CommandStartData> {
  private readonly logger = new Logger(CommandStartHandler.name);

  constructor(private readonly messagesService: MessagesService) {}

  async handle(
    data: CommandStartData,
    client: Socket,
    server?: Server,
  ): Promise<{ status: 'ok' | 'error' }> {
    try {
      const taskId = extractTaskId(data.roomId);
      const ts = Date.now();

      await this.messagesService.create({
        roomId: data.roomId,
        taskId,
        role: MessageRole.System,
        agentId: data.agentId,
        agentName: data.agentName,
        jobId: data.jobId,
        command: data.command,
        messageType: MessageType.COMMAND_START,
        content: `[${data.agentName}] started: ${data.command}`,
        ts,
      });

      server?.to(data.roomId).emit(EventCommands.AgentCommandStart, {
        agentId: data.agentId,
        agentName: data.agentName,
        jobId: data.jobId,
        command: data.command,
        ts,
      });

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle agent:command:start', error);
      client.emit('error', { message: 'Failed to save command start' });
      return { status: 'error' };
    }
  }
}
```

- [x] Create `apps/server/src/gateways/message-handlers/command-exit.handler.ts`:

```typescript
// apps/server/src/gateways/message-handlers/command-exit.handler.ts

import { Injectable, Logger } from '@nestjs/common';
import { EventCommands, MessageRole } from '@onezone/shared';
import { MessageType } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { extractTaskId } from '@onezone/shared';
import { IMessageHandler } from './message-handler.interface';

export interface CommandExitData {
  roomId: string;
  agentId: string;
  agentName?: string;
  jobId: string;
  command: string;
  exitCode: number;
}

@Injectable()
export class CommandExitHandler implements IMessageHandler<CommandExitData> {
  private readonly logger = new Logger(CommandExitHandler.name);

  constructor(private readonly messagesService: MessagesService) {}

  async handle(
    data: CommandExitData,
    client: Socket,
    server?: Server,
  ): Promise<{ status: 'ok' | 'error' }> {
    try {
      const taskId = extractTaskId(data.roomId);
      const ts = Date.now();

      await this.messagesService.create({
        roomId: data.roomId,
        taskId,
        role: MessageRole.System,
        agentId: data.agentId,
        agentName: data.agentName,
        jobId: data.jobId,
        command: data.command,
        messageType: MessageType.COMMAND_EXIT,
        content: `[${data.agentId}] exited with code ${data.exitCode}: ${data.command}`,
        ts,
      });

      server?.to(data.roomId).emit(EventCommands.AgentCommandExit, {
        agentId: data.agentId,
        jobId: data.jobId,
        command: data.command,
        exitCode: data.exitCode,
        ts,
      });

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle agent:command:exit', error);
      client.emit('error', { message: 'Failed to save command exit' });
      return { status: 'error' };
    }
  }
}
```

- [x] Replace `apps/server/src/gateways/chat.gateway.ts` with the content below:

```typescript
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
import { Logger } from '@nestjs/common';
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
```

- [x] Replace `apps/server/src/gateways/gateways.module.ts` with the content below (registers all new handler providers):

```typescript
// apps/server/src/gateways/gateways.module.ts

import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AgentRegistryModule } from './agent-registry.module';
import { MessagesModule } from '../messages/messages.module';
import { TasksModule } from '../tasks/tasks.module';
import { AgentsModule } from '../agents/agents.module';
import { ChatMessageHandler } from './message-handlers/chat-message.handler';
import { OutputLineHandler } from './message-handlers/output-line.handler';
import { CommandStartHandler } from './message-handlers/command-start.handler';
import { CommandExitHandler } from './message-handlers/command-exit.handler';

@Module({
  imports: [MessagesModule, TasksModule, AgentsModule, AgentRegistryModule],
  providers: [
    ChatGateway,
    ChatMessageHandler,
    OutputLineHandler,
    CommandStartHandler,
    CommandExitHandler,
  ],
})
export class GatewaysModule {}
```

- [x] Update `apps/server/src/agents/agents.service.ts` to import `STALE_THRESHOLD_MS` from shared instead of the local constant:

```typescript
// apps/server/src/agents/agents.service.ts

import { ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { STALE_THRESHOLD_MS } from '@onezone/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterAgentInput {
  name: string;
  hostname: string;
}

@Injectable()
export class AgentsService implements OnModuleInit {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.markAllAgentsDisconnected();
  }

  async markAllAgentsDisconnected() {
    const { count } = await this.prisma.agent.updateMany({
      where: { isConnected: true },
      data: { isConnected: false },
    });
    if (count > 0) {
      this.logger.log(`Marked ${count} agent(s) as disconnected on server start`);
    }
  }

  findAll() {
    return this.prisma.agent.findMany({
      orderBy: [{ isConnected: 'desc' }, { name: 'asc' }],
    });
  }

  async registerByName(input: RegisterAgentInput) {
    const existing = await this.prisma.agent.findUnique({ where: { name: input.name } });

    if (existing?.isConnected) {
      throw new ConflictException(
        `Agent "${input.name}" is already connected. Stop the running agent before starting a new one.`,
      );
    }

    if (existing) {
      this.logger.log(`Agent re-registered: ${existing.id} (${existing.name})`);
      return existing;
    }

    const agent = await this.prisma.agent.create({
      data: {
        id: randomUUID(),
        name: input.name,
        hostname: input.hostname,
        isConnected: false,
      },
    });
    this.logger.log(`Agent created: ${agent.id} (${agent.name})`);
    return agent;
  }

  async updateHeartbeat(agentId: string) {
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { lastSeenAt: new Date() },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async markStaleAgentsDisconnected() {
    const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);
    const { count } = await this.prisma.agent.updateMany({
      where: { isConnected: true, lastSeenAt: { lt: threshold } },
      data: { isConnected: false },
    });
    if (count > 0) {
      this.logger.warn(`Marked ${count} stale agent(s) as disconnected`);
    }
  }

  async markConnected(agentId: string) {
    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { isConnected: true, lastSeenAt: new Date() },
    });
    this.logger.log(`Agent connected: ${agent.id} (${agent.name})`);
    return agent;
  }

  async markDisconnected(agentId: string) {
    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { isConnected: false, lastSeenAt: new Date() },
    });
    this.logger.log(`Agent disconnected: ${agent.id} (${agent.name})`);
    return agent;
  }
}
```

- [x] Build the server to verify no errors:

```bash
pnpm --filter @onezone/server build
```

##### Step 2 Verification Checklist
- [x] `pnpm --filter @onezone/server build` exits with code 0
- [ ] Start server: `pnpm --filter @onezone/server dev`
- [ ] Connect an agent: `node apps/agent/bin/dev.js listen --name test-agent --server http://localhost:5026`
- [ ] Verify agent connects, heartbeats every 30s in server logs
- [ ] Send a chat message from the web UI and verify it appears in the task room
- [ ] Assign a task and run a command — verify output streams and exit code appear

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 3: Agent — Decompose Listen Command

- [x] Create `apps/agent/src/lib/agent-registration.ts`:

```typescript
// apps/agent/src/lib/agent-registration.ts

import { hostname } from 'node:os';

export interface RegisterAgentInput {
  serverUrl: string;
  name: string;
}

/**
 * Registers the agent with the server via HTTP POST /agents/register.
 * Returns the agentId on success, throws on failure.
 */
export async function registerAgent(input: RegisterAgentInput): Promise<string> {
  const { serverUrl, name } = input;
  const url = `${serverUrl}/agents/register`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, hostname: hostname() }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach server at ${serverUrl}: ${message}`);
  }

  if (response.status === 409) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Agent "${name}" is already connected.`);
  }

  if (!response.ok) {
    throw new Error(`Server registration failed (HTTP ${response.status})`);
  }

  const agent = await response.json() as { id: string };
  return agent.id;
}
```

- [x] Create `apps/agent/src/lib/task-socket.ts`:

```typescript
// apps/agent/src/lib/task-socket.ts

import { EventCommands, HEARTBEAT_INTERVAL_MS, createTaskRoomId } from '@onezone/shared';
import { Socket } from 'socket.io-client';
import { createAgentSocket } from './socket-client.js';

export interface TaskSocketCallbacks {
  onConnect: (roomId: string) => void;
  onMessage: (event: string, payload: unknown) => void;
  onConnectError: (roomId: string, err: Error) => void;
  onDisconnect: (roomId: string, reason: string) => void;
}

export interface TaskSocketConnection {
  socket: Socket;
  cleanup: () => void;
}

/**
 * Creates a socket connection to a task room, setting up heartbeat and
 * lifecycle handlers. Returns the socket and a cleanup function.
 *
 * The caller receives raw socket events via callbacks, allowing the
 * command layer to remain the single source of truth for business logic.
 */
export function createTaskSocket(
  serverUrl: string,
  taskId: string,
  agentId: string,
  agentName: string,
  callbacks: TaskSocketCallbacks,
): TaskSocketConnection {
  const roomId = createTaskRoomId(taskId);

  const socket = createAgentSocket({ serverUrl, taskId, agentId, agentName });

  let heartbeatTimer: NodeJS.Timeout | undefined;

  socket.on('connect', () => {
    heartbeatTimer = setInterval(() => {
      socket.emit(EventCommands.AgentHeartbeat);
    }, HEARTBEAT_INTERVAL_MS);
    callbacks.onConnect(roomId);
  });

  // Forward all relevant events to the callback
  const forwardedEvents = [
    'chat:message',
    EventCommands.AssignTask,
  ] as const;

  for (const event of forwardedEvents) {
    socket.on(event, (payload: unknown) => callbacks.onMessage(event, payload));
  }

  socket.on('connect_error', (err) => {
    clearInterval(heartbeatTimer);
    callbacks.onConnectError(roomId, err);
  });

  socket.on('disconnect', (reason) => {
    clearInterval(heartbeatTimer);
    callbacks.onDisconnect(roomId, reason);
  });

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    socket.disconnect();
  };

  return { socket, cleanup };
}

/**
 * Creates a lobby socket connection (no taskId), setting up heartbeat and
 * lifecycle handlers.
 */
export function createLobbySocket(
  serverUrl: string,
  agentId: string,
  agentName: string,
  callbacks: TaskSocketCallbacks,
): TaskSocketConnection {
  const socket = createAgentSocket({ serverUrl, agentId, agentName });

  let heartbeatTimer: NodeJS.Timeout | undefined;

  socket.on('connect', () => {
    heartbeatTimer = setInterval(() => {
      socket.emit(EventCommands.AgentHeartbeat);
    }, HEARTBEAT_INTERVAL_MS);
    callbacks.onConnect('lobby');
  });

  socket.on(EventCommands.AssignTask, (payload: unknown) =>
    callbacks.onMessage(EventCommands.AssignTask, payload),
  );

  socket.on('connect_error', (err) => {
    clearInterval(heartbeatTimer);
    callbacks.onConnectError('lobby', err);
  });

  socket.on('disconnect', (reason) => {
    clearInterval(heartbeatTimer);
    callbacks.onDisconnect('lobby', reason);
  });

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    socket.disconnect();
  };

  return { socket, cleanup };
}
```

- [x] Replace `apps/agent/src/commands/listen.ts` with the content below:

```typescript
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

    return new Promise<void>((_, reject) => {
      const activeProcesses = new Map<string, ReturnType<typeof runProcess>>();

      const { socket } = createTaskSocket(serverUrl, taskId, agentId, agentName, {
        onConnect: () => {
          this.log(
            `[${agentName}] Connected to ${serverUrl} | room: ${roomId} | Listening for commands...`,
          );
        },
        onMessage: (event, payload) => {
          if (event !== 'chat:message') return;
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
            this.activeTaskIds.delete(taskId);
            reject(new Error(`[${roomId}] Disconnected: ${reason}`));
          } else {
            this.log(`[${agentName}] [${roomId}] Disconnected (${reason}), reconnecting...`);
          }
        },
      });
    });
  }
}
```

- [x] Build the agent to verify no errors:

```bash
pnpm --filter @onezone/agent build
```

##### Step 3 Verification Checklist
- [x] `pnpm --filter @onezone/agent build` exits with code 0
- [ ] Run: `node apps/agent/bin/dev.js listen --name test-agent --server http://localhost:5026`
- [ ] Agent connects and logs "Waiting for task assignment..."
- [ ] Assign a task in the UI; agent logs "Assigned to task: ..."
- [ ] Send a command; verify output lines stream in real-time and exit code appears
- [ ] Disconnect agent; verify UI shows "disconnected" status

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 4: Web — HTTP Client & API Layer

- [x] Create `apps/web/src/lib/http-client.ts`:

```typescript
// apps/web/src/lib/http-client.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5026';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${path}`);
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const httpClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
};
```

- [x] Replace `apps/web/src/lib/api.ts` with the content below:

```typescript
// apps/web/src/lib/api.ts

import { TaskStatus } from '@onezone/shared';
import { httpClient } from './http-client';

export interface TaskOrderItem {
  id: string;
  status: TaskStatus;
  order: number;
}

export const fetchProjects = () => httpClient.get('/projects');

export const createProject = (data: { name: string; description?: string }) =>
  httpClient.post('/projects', data);

export const deleteProject = (id: string) => httpClient.delete(`/projects/${id}`);

export const fetchProject = (id: string) => httpClient.get(`/projects/${id}`);

export const fetchTasks = (projectId: string) =>
  httpClient.get(`/projects/${projectId}/tasks`);

export const createTask = (
  projectId: string,
  data: { name: string; description?: string; agentId?: string | null },
) => httpClient.post(`/projects/${projectId}/tasks`, data);

export const assignTaskAgent = (taskId: string, agentId: string | null) =>
  httpClient.patch(`/tasks/${taskId}/agent`, { agentId });

export const fetchTask = (taskId: string) => httpClient.get(`/tasks/${taskId}`);

export const fetchMessages = (taskId: string) =>
  httpClient.get(`/tasks/${taskId}/messages`);

export const updateTaskStatus = (taskId: string, status: TaskStatus) =>
  httpClient.patch(`/tasks/${taskId}/status`, { status });

export const fetchAgents = () => httpClient.get('/agents');

export const reorderTasks = (projectId: string, tasks: TaskOrderItem[]) =>
  httpClient.put(`/projects/${projectId}/tasks/reorder`, { tasks });
```

- [x] Build the web app to verify no errors:

```bash
pnpm --filter @onezone/web build
```

##### Step 4 Verification Checklist
- [x] `pnpm --filter @onezone/web build` exits with code 0
- [ ] Create a project in the UI — succeeds
- [ ] Create a task — succeeds
- [ ] Drag a task between kanban columns — succeeds and persists after reload
- [ ] Assign an agent to a task — succeeds
- [ ] Delete a project — succeeds

#### Step 4 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

---

#### Step 5: Web — Hook Decomposition & buildChatItems

- [x] Create `apps/web/src/hooks/useSocketConnection.ts`:

```typescript
// apps/web/src/hooks/useSocketConnection.ts

'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5026';

export function useSocketConnection(taskId: string): {
  socket: Socket | null;
  isConnected: boolean;
} {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: { taskId, role: 'user' },
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [taskId]);

  return { socket: socketRef.current, isConnected };
}
```

- [x] Create `apps/web/src/hooks/useConnectedAgents.ts`:

```typescript
// apps/web/src/hooks/useConnectedAgents.ts

'use client';

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { ConnectedAgent } from './useTaskRoom';

export function useConnectedAgents(socket: Socket | null): ConnectedAgent[] {
  const [agents, setAgents] = useState<Map<string, ConnectedAgent>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const onConnected = (info: ConnectedAgent & { ts: number }) => {
      setAgents((prev) => {
        const next = new Map(prev);
        next.set(info.agentId, {
          agentId: info.agentId,
          agentName: info.agentName,
          taskId: info.taskId,
        });
        return next;
      });
    };

    const onDisconnected = (info: { agentId: string }) => {
      setAgents((prev) => {
        const next = new Map(prev);
        next.delete(info.agentId);
        return next;
      });
    };

    socket.on('agent:connected', onConnected);
    socket.on('agent:disconnected', onDisconnected);

    return () => {
      socket.off('agent:connected', onConnected);
      socket.off('agent:disconnected', onDisconnected);
    };
  }, [socket]);

  return Array.from(agents.values());
}
```

- [x] Replace `apps/web/src/hooks/useTaskRoom.ts` with the content below:

```typescript
// apps/web/src/hooks/useTaskRoom.ts

'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageType } from '@onezone/shared';

export interface RoomMessage {
  id?: string;
  roomId: string;
  role: 'user' | 'agent' | 'system';
  agentId?: string | null;
  agentName?: string | null;
  jobId?: string | null;
  command?: string | null;
  stream?: 'stdout' | 'stderr' | null;
  exitCode?: number | null;
  content: string;
  messageType?: string | null;
  ts: number;
}

export interface ConnectedAgent {
  agentId: string;
  agentName: string;
  taskId: string;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: 'SET_MESSAGES'; messages: RoomMessage[] }
  | { type: 'APPEND_MESSAGE'; message: RoomMessage }
  | { type: 'AGENT_CONNECTED'; info: ConnectedAgent & { ts: number } }
  | { type: 'AGENT_DISCONNECTED'; info: { agentId: string; agentName?: string; ts: number } }
  | { type: 'COMMAND_START'; payload: { agentId: string; agentName: string; jobId: string; command: string; ts: number }; taskId: string }
  | { type: 'COMMAND_EXIT'; payload: { agentId: string; jobId: string; command: string; exitCode: number; ts: number }; taskId: string };

interface State {
  messages: RoomMessage[];
  connectedAgents: Map<string, ConnectedAgent>;
}

function buildSyntheticExits(
  messages: RoomMessage[],
  agentId: string,
  agentName: string | undefined,
  ts: number,
): RoomMessage[] {
  const startedJobs = new Map<string, { command?: string | null; roomId: string }>();
  const completedJobs = new Set<string>();

  for (const msg of messages) {
    if (msg.agentId !== agentId || !msg.jobId) continue;
    if (msg.messageType === MessageType.CommandStart) {
      startedJobs.set(msg.jobId, { command: msg.command, roomId: msg.roomId });
    }
    if (msg.exitCode != null || msg.messageType === MessageType.CommandExit) {
      completedJobs.add(msg.jobId);
    }
  }

  const exits: RoomMessage[] = [];
  for (const [jobId, { command, roomId }] of startedJobs) {
    if (!completedJobs.has(jobId)) {
      exits.push({
        roomId,
        role: 'system',
        agentId,
        agentName: agentName ?? null,
        jobId,
        command,
        exitCode: -1,
        content: command ?? jobId,
        ts,
      });
    }
  }
  return exits;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages };

    case 'APPEND_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'COMMAND_START': {
      const { payload, taskId } = action;
      const msg: RoomMessage = {
        roomId: `task:${taskId}`,
        role: 'system',
        agentId: payload.agentId,
        agentName: payload.agentName,
        jobId: payload.jobId,
        command: payload.command,
        content: `[${payload.agentName}] started: ${payload.command}`,
        messageType: MessageType.CommandStart,
        ts: payload.ts,
      };
      return { ...state, messages: [...state.messages, msg] };
    }

    case 'COMMAND_EXIT': {
      const { payload, taskId } = action;
      const msg: RoomMessage = {
        roomId: `task:${taskId}`,
        role: 'system',
        agentId: payload.agentId,
        jobId: payload.jobId,
        command: payload.command,
        exitCode: payload.exitCode,
        content: payload.command,
        ts: payload.ts,
      };
      return { ...state, messages: [...state.messages, msg] };
    }

    case 'AGENT_CONNECTED': {
      const { info } = action;
      const next = new Map(state.connectedAgents);
      next.set(info.agentId, {
        agentId: info.agentId,
        agentName: info.agentName,
        taskId: info.taskId,
      });
      const noticeMsg: RoomMessage = {
        roomId: `task:${info.taskId}`,
        role: 'system',
        agentId: info.agentId,
        agentName: info.agentName,
        content: `${info.agentName} connected`,
        ts: info.ts,
      };
      return {
        connectedAgents: next,
        messages: [...state.messages, noticeMsg],
      };
    }

    case 'AGENT_DISCONNECTED': {
      const { info } = action;
      const next = new Map(state.connectedAgents);
      const agent = next.get(info.agentId);
      next.delete(info.agentId);

      const syntheticExits = buildSyntheticExits(
        state.messages,
        info.agentId,
        agent?.agentName ?? info.agentName,
        info.ts,
      );

      const noticeMsg: RoomMessage = {
        roomId: state.messages[0]?.roomId ?? '',
        role: 'system',
        agentId: info.agentId,
        agentName: agent?.agentName ?? info.agentName ?? null,
        content: `${agent?.agentName ?? info.agentName ?? info.agentId} disconnected`,
        ts: info.ts,
      };

      return {
        connectedAgents: next,
        messages: [...state.messages, ...syntheticExits, noticeMsg],
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5026';

const initialState: State = {
  messages: [],
  connectedAgents: new Map(),
};

export function useTaskRoom(taskId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isConnected, setIsConnected] = useReducerState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: { taskId, role: 'user' },
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('chat:message', (msg: RoomMessage) => {
      dispatch({ type: 'APPEND_MESSAGE', message: msg });
    });

    socket.on('output:line', (msg: RoomMessage) => {
      dispatch({ type: 'APPEND_MESSAGE', message: msg });
    });

    socket.on(
      'agent:command:start',
      (payload: { agentId: string; agentName: string; jobId: string; command: string; ts: number }) => {
        dispatch({ type: 'COMMAND_START', payload, taskId });
      },
    );

    socket.on(
      'agent:command:exit',
      (payload: { agentId: string; jobId: string; command: string; exitCode: number; ts: number }) => {
        dispatch({ type: 'COMMAND_EXIT', payload, taskId });
      },
    );

    socket.on('agent:connected', (info: ConnectedAgent & { ts: number }) => {
      dispatch({ type: 'AGENT_CONNECTED', info });
    });

    socket.on(
      'agent:disconnected',
      (info: { agentId: string; agentName?: string; ts: number }) => {
        dispatch({ type: 'AGENT_DISCONNECTED', info });
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [taskId]);

  const sendMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      if (!socket || !state.isConnected) return;
      socket.emit('chat:message', {
        roomId: `task:${taskId}`,
        content,
      });
    },
    [taskId, state.isConnected],
  );

  const prependMessages = useCallback((msgs: RoomMessage[]) => {
    dispatch({ type: 'SET_MESSAGES', messages: msgs });
  }, []);

  return {
    messages: state.messages,
    connectedAgents: Array.from(state.connectedAgents.values()),
    isConnected: state.isConnected,
    sendMessage,
    prependMessages,
  };
}

// ---------------------------------------------------------------------------
// Minimal useState-compatible helper that works with useReducer
// ---------------------------------------------------------------------------

function useReducerState<T>(
  initial: T,
): [T, (value: T) => void] {
  const [val, dispatch] = useReducer((_: T, v: T) => v, initial);
  return [val, dispatch];
}
```

> **Note:** The `useSocketConnection` and `useConnectedAgents` hooks created above are standalone utilities available for future use. `useTaskRoom` is kept as the primary hook consumed by `page.tsx` to minimize diff surface. If you prefer full decomposition, replace `useTaskRoom` in `page.tsx` with the three-hook composition — both approaches produce identical behavior.

- [x] Replace `apps/web/src/app/projects/[id]/tasks/[taskId]/page.tsx` with the content below (simplified `buildChatItems` with extracted pure helpers):

```typescript
// apps/web/src/app/projects/[id]/tasks/[taskId]/page.tsx

'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchTask, fetchMessages, fetchAgents, assignTaskAgent } from '@/lib/api';
import { useTaskRoom } from '@/hooks/useTaskRoom';
import { MessageType } from '@onezone/shared';
import { MessageLine } from '@/components/MessageLine';
import { CommandGroup, type CommandGroupData } from '@/components/CommandGroup';
import { AgentStatusBar } from '@/components/AgentStatusBar';
import { MessageInput } from '@/components/MessageInput';
import type { Agent } from '@onezone/shared';
import type { RoomMessage } from '@/hooks/useTaskRoom';

type ChatItem =
  | { type: 'message'; msg: RoomMessage }
  | { type: 'command'; group: CommandGroupData };

// ---------------------------------------------------------------------------
// Pure helpers for buildChatItems
// ---------------------------------------------------------------------------

function handleCommandGroup(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  const group: CommandGroupData = {
    jobId: msg.jobId,
    command: msg.command ?? msg.content,
    agentName: msg.agentName,
    startTs: msg.ts,
    lines: [],
  };
  groupMap.set(msg.jobId, group);
  items.push({ type: 'message', msg });
  items.push({ type: 'command', group });
}

function handleOutputLine(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  let group = groupMap.get(msg.jobId);
  if (!group) {
    group = {
      jobId: msg.jobId,
      command: msg.command ?? '(unknown)',
      agentName: msg.agentName,
      startTs: msg.ts,
      lines: [],
    };
    groupMap.set(msg.jobId, group);
    items.push({ type: 'command', group });
  }
  group.lines.push(msg);
}

function handleCommandExit(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  const group = groupMap.get(msg.jobId);
  const code =
    msg.exitCode ??
    parseInt(msg.content.match(/exited with code (\d+)/)?.[1] ?? '-1', 10);
  if (group) group.exitCode = code;
  items.push({
    type: 'message',
    msg: { ...msg, exitCode: code, content: msg.command ?? msg.content },
  });
}

function buildChatItems(messages: RoomMessage[]): ChatItem[] {
  const groupMap = new Map<string, CommandGroupData>();
  const items: ChatItem[] = [];

  for (const msg of messages) {
    if (msg.jobId) {
      if (msg.messageType === MessageType.CommandStart) {
        handleCommandGroup(msg, groupMap, items);
        continue;
      }
      if (msg.role === 'agent') {
        handleOutputLine(msg, groupMap, items);
        continue;
      }
      if (msg.role === 'system' && (msg.exitCode != null || msg.content.includes('exited with code'))) {
        handleCommandExit(msg, groupMap, items);
        continue;
      }
    }
    items.push({ type: 'message', msg });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function TaskChatPage() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => fetchTask(taskId),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });

  const assignMutation = useMutation({
    mutationFn: (agentId: string | null) => assignTaskAgent(taskId, agentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['messages', taskId],
    queryFn: () => fetchMessages(taskId),
  });

  const { messages, connectedAgents, isConnected, sendMessage, prependMessages } =
    useTaskRoom(taskId);

  useEffect(() => {
    if (history.length > 0) {
      prependMessages(history);
    }
  }, [history, prependMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const chatItems = useMemo(() => buildChatItems(messages), [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="text-xs text-gray-400 mb-1">
          <Link href="/" className="hover:underline">Projects</Link>
          {' / '}
          <Link href={`/projects/${projectId}`} className="hover:underline">Project</Link>
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-semibold">{task?.name || 'Loading...'}</h1>
          <div className="flex items-center gap-2">
            <select
              className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200"
              value={task?.agentId ?? ''}
              disabled={assignMutation.isPending}
              onChange={(e) => assignMutation.mutate(e.target.value || null)}
            >
              <option value="">No agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.isConnected ? '● ' : '○ '}
                  {a.name}
                </option>
              ))}
            </select>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isConnected
                  ? 'bg-green-900 text-green-300'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {isConnected ? 'connected' : 'disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Agent status */}
      <AgentStatusBar agents={connectedAgents} />

      {/* Message area */}
      <div className="flex-1 overflow-y-auto py-2">
        {chatItems.map((item, i) =>
          item.type === 'command' ? (
            <CommandGroup key={item.group.jobId} group={item.group} />
          ) : (
            <MessageLine key={item.msg.id || i} message={item.msg} />
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={!isConnected} />
    </div>
  );
}
```

- [x] Build the web app to verify no errors:

```bash
pnpm --filter @onezone/web build
```

##### Step 5 Verification Checklist
- [x] `pnpm --filter @onezone/web build` exits with code 0
- [ ] Open a task page — messages load from history
- [ ] Run a command via connected agent — output lines stream in real-time
- [ ] Exit code appears after command completes
- [ ] Agent connected/disconnected status updates in the status bar
- [ ] Disconnecting agent mid-command produces synthetic exit message with exitCode -1
- [ ] Auto-scroll works on new messages

#### Step 5 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
