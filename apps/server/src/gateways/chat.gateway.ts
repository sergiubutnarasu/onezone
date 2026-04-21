import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import {
  EventCommands,
  MessageRole,
  MessageStream,
  SocketAuthSchema,
} from "@onezone/shared";
import { AgentRegistryService } from "./agent-registry.service";
import { SYSTEM_AGENTS_ROOM } from "./constants";
import { MessageType } from "@prisma/client";
import { Server, Socket } from "socket.io";
import { MessagesService } from "../messages/messages.service";
import { TasksService } from "../tasks/tasks.service";
import { AgentsService } from "../agents/agents.service";

interface AgentSocketMeta {
  taskId?: string;
  role: Exclude<MessageRole, MessageRole.System>;
  agentId?: string;
  agentName?: string;
  agentHostname?: string;
}

@WebSocketGateway({
  namespace: "/chat",
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5025",
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly socketMeta = new Map<string, AgentSocketMeta>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly tasksService: TasksService,
    private readonly agentsService: AgentsService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  afterInit(server: Server): void {
    this.agentRegistry.setServer(server);
  }

  async handleConnection(client: Socket) {
    const result = SocketAuthSchema.safeParse(client.handshake.auth);

    if (!result.success) {
      this.logger.warn(
        `Socket ${client.id} rejected: invalid auth — ${result.error.message}`,
      );
      client.emit("error", { message: "Invalid connection parameters" });
      client.disconnect();
      return;
    }

    const { taskId, agentId, agentName } = result.data;
    const agentHostname = result.data.agentHostname;
    const role = result.data.role as Exclude<MessageRole, MessageRole.System>;

    if (taskId) {
      // Connecting to a specific task room — validate the task exists
      try {
        await this.tasksService.findOne(taskId);
      } catch (error) {
        this.logger.warn(
          `Socket ${client.id} rejected: task ${taskId} not found`,
          error,
        );
        client.emit("error", { message: "Task not found" });
        client.disconnect();
        return;
      }

      const roomId = `task:${taskId}`;
      await client.join(roomId);

      this.socketMeta.set(client.id, { taskId, role, agentId, agentName, agentHostname });

      if (role === MessageRole.Agent && agentId) {
        this.agentRegistry.registerTaskSocket(taskId, client.id);

        await this.agentsService.markConnected(agentId);

        this.server.to(roomId).emit(EventCommands.AgentConnected, {
          agentId,
          agentName: agentName ?? agentId,
          taskId,
          ts: Date.now(),
        });
      } else if (role === MessageRole.User) {
        const ts = Date.now();
        for (const m of this.socketMeta.values()) {
          if (m.taskId === taskId && m.role === MessageRole.Agent && m.agentId) {
            client.emit("agent:connected", {
              agentId: m.agentId,
              agentName: m.agentName ?? m.agentId,
              taskId,
              ts,
            });
          }
        }
      }
    } else {
      // No taskId — agent joins the system lobby and waits for assignment
      await client.join(SYSTEM_AGENTS_ROOM);
      this.socketMeta.set(client.id, { role, agentId, agentName, agentHostname });

      if (role === MessageRole.Agent && agentId) {
        this.agentRegistry.register(agentId, client.id);
        await this.agentsService.markConnected(agentId);
        this.logger.log(`Agent ${agentId} (${agentName}) joined system lobby`);

        const assignedTasks = await this.tasksService.findByAgent(agentId);
        for (const task of assignedTasks) {
          this.agentRegistry.assignTask(agentId, task.id);
        }
      }
    }
  }

  async handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (meta && meta.role === MessageRole.Agent && meta.agentId) {
      if (meta.taskId) {
        // Task socket closed — notify room but don't touch the registry or DB connected state,
        // because the agent's lobby socket may still be alive.
        this.agentRegistry.deregisterTaskSocket(meta.taskId, client.id);
        const roomId = `task:${meta.taskId}`;
        this.server.to(roomId).emit(EventCommands.AgentDisconnected, {
          agentId: meta.agentId,
          agentName: meta.agentName ?? meta.agentId,
          taskId: meta.taskId,
          ts: Date.now(),
        });
      } else {
        // Lobby socket closed — agent is truly gone.
        this.agentRegistry.deregister(meta.agentId);
        await this.agentsService.markDisconnected(meta.agentId);
      }
    }
    this.socketMeta.delete(client.id);
  }

  @SubscribeMessage(EventCommands.AgentHeartbeat)
  async handleAgentHeartbeat(@ConnectedSocket() client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (meta?.agentId) {
      await this.agentsService.updateHeartbeat(meta.agentId);
    }
  }

  @SubscribeMessage("chat:message")
  async handleChatMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const taskId = this.extractTaskId(data.roomId);
      const ts = Date.now();

      const message = await this.messagesService.create({
        roomId: data.roomId,
        taskId,
        role: MessageRole.User,
        content: data.content,
        ts,
      });

      this.server
        .to(data.roomId)
        .emit("chat:message", { ...message, ts: Number(message.ts) });
      return { status: "ok" };
    } catch (error) {
      this.logger.error("Failed to handle chat:message", error);
      client.emit("error", { message: "Failed to save message" });
      return { status: "error" };
    }
  }

  @SubscribeMessage("output:line")
  async handleOutputLine(
    @MessageBody()
    data: {
      roomId: string;
      agentId: string;
      agentName: string;
      jobId?: string;
      command?: string;
      stream: MessageStream;
      content: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const taskId = this.extractTaskId(data.roomId);
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

      this.server
        .to(data.roomId)
        .emit("output:line", { ...message, ts: Number(message.ts) });
      return { status: "ok" };
    } catch (error) {
      this.logger.error("Failed to handle output:line", error);
      client.emit("error", { message: "Failed to save output line" });
      return { status: "error" };
    }
  }

  @SubscribeMessage("agent:command:start")
  async handleCommandStart(
    @MessageBody()
    data: {
      roomId: string;
      agentId: string;
      agentName: string;
      jobId: string;
      command: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const taskId = this.extractTaskId(data.roomId);
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

      this.server.to(data.roomId).emit(EventCommands.AgentCommandStart, {
        agentId: data.agentId,
        agentName: data.agentName,
        jobId: data.jobId,
        command: data.command,
        ts,
      });
      return { status: "ok" };
    } catch (error) {
      this.logger.error("Failed to handle agent:command:start", error);
      client.emit("error", { message: "Failed to save command start" });
      return { status: "error" };
    }
  }

  @SubscribeMessage("agent:command:exit")
  async handleCommandExit(
    @MessageBody()
    data: {
      roomId: string;
      agentId: string;
      jobId: string;
      command: string;
      exitCode: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const taskId = this.extractTaskId(data.roomId);
      const ts = Date.now();

      const agentName = this.socketMeta.get(client.id)?.agentName;

      await this.messagesService.create({
        roomId: data.roomId,
        taskId,
        role: MessageRole.System,
        agentId: data.agentId,
        agentName,
        jobId: data.jobId,
        command: data.command,
        messageType: MessageType.COMMAND_EXIT,
        content: `[${data.agentId}] exited with code ${data.exitCode}: ${data.command}`,
        ts,
      });

      this.server.to(data.roomId).emit(EventCommands.AgentCommandExit, {
        agentId: data.agentId,
        jobId: data.jobId,
        command: data.command,
        exitCode: data.exitCode,
        ts,
      });
      return { status: "ok" };
    } catch (error) {
      this.logger.error("Failed to handle agent:command:exit", error);
      client.emit("error", { message: "Failed to save command exit" });
      return { status: "error" };
    }
  }

  private extractTaskId(roomId: string): string {
    return roomId.replace("task:", "");
  }
}
