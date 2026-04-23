// apps/server/src/gateways/message-handlers/chat-message.handler.ts

import { Injectable, Logger } from '@nestjs/common';
import { MessageRole } from '@onezone/shared';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { extractTaskId } from '@onezone/shared';
import { IMessageHandler } from './message-handler.interface';
import { TasksService } from '../../tasks/tasks.service';

export interface ChatMessageData {
  roomId: string;
  content: string;
}

@Injectable()
export class ChatMessageHandler implements IMessageHandler<ChatMessageData> {
  private readonly logger = new Logger(ChatMessageHandler.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly tasksService: TasksService,
  ) {}

  async handle(
    data: ChatMessageData,
    client: Socket,
    server?: Server,
  ): Promise<{ status: 'ok' | 'error' }> {
    try {
      const taskId = extractTaskId(data.roomId);
      const ts = Date.now();

      const [message, task] = await Promise.all([
        this.messagesService.create({
          roomId: data.roomId,
          taskId,
          role: MessageRole.User,
          content: data.content,
          ts,
        }),
        this.tasksService.findOne(taskId).catch(() => null),
      ]);

      const taskDetails = task
        ? {
            id: task.id,
            name: task.name,
            description: task.description,
            status: task.status,
            project: {
              id: task.project.id,
              name: task.project.name,
              description: task.project.description,
            },
          }
        : null;

      server
        ?.to(data.roomId)
        .emit('chat:message', { ...message, ts: Number(message.ts), task: taskDetails });

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle chat:message', error);
      client.emit('error', { message: 'Failed to save message' });
      return { status: 'error' };
    }
  }
}
