// apps/server/src/gateways/message-handlers/chat-message.handler.ts

import { Injectable, Logger } from "@nestjs/common";
import { extractTaskId, MessageRole } from "@onezone/shared";
import { Server, Socket } from "socket.io";
import { MessagesService } from "../../messages/messages.service";
import { TasksService } from "../../tasks/tasks.service";
import { TerminalRegistryService } from "../terminal-registry.service";
import { IMessageHandler } from "./message-handler.interface";
import type { ChatMessageData } from "../../types";

@Injectable()
export class ChatMessageHandler implements IMessageHandler<ChatMessageData> {
  private readonly logger = new Logger(ChatMessageHandler.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly tasksService: TasksService,
    private readonly terminalRegistry: TerminalRegistryService,
  ) {}

  async handle(
    data: ChatMessageData,
    client: Socket,
    server?: Server,
    userId?: string,
  ): Promise<{ status: "ok" | "error" }> {
    try {
      const taskId = extractTaskId(data.roomId);
      const ts = Date.now();
      const effectiveUserId = userId ?? (client.data as { userId?: string }).userId ?? '';

      const task = await this.tasksService.findOne(taskId, effectiveUserId).catch(() => null);
      if (task?.completedAt) {
        client.emit("error", { message: "Task is completed" });
        return { status: "error" };
      }

      const taskDetails = task
        ? await this.tasksService.findOneDetails(taskId, effectiveUserId).catch(() => null)
        : null;

      const message = await this.messagesService.create({
        roomId: data.roomId,
        taskId,
        role: MessageRole.User,
        terminalId: (task?.terminal as { id?: string } | null)?.id ?? undefined,
        terminalName:
          (task?.terminal as { name?: string } | null)?.name ?? undefined,
        messageType: "CHAT",
        content: data.content,
        userId: effectiveUserId,
        ts,
      });

      const payload = {
        ...message,
        ts: Number(message.ts),
        task: taskDetails,
      };

      server?.to(data.roomId).emit("chat:message", payload);

      this.terminalRegistry.forwardCommandRunToTerminal(taskId, payload);

      return { status: "ok" };
    } catch (error) {
      this.logger.error("Failed to handle chat:message", error);
      client.emit("error", { message: "Failed to save message" });
      return { status: "error" };
    }
  }
}
