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
  terminalId?: string;
  terminalName?: string;
  jobId: string;
  command: string;
  agentId?: string;
  agentName?: string;
  model?: string;
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
        terminalId: data.terminalId,
        terminalName: data.terminalName,
        messageType: MessageType.COMMAND_START,
        jobId: data.jobId,
        command: data.command,
        content: `[${data.terminalName}] started: ${data.command}`,
        agentId: data.agentId,
        model: data.model,
        ts,
      });

      server?.to(data.roomId).emit(EventCommands.TerminalCommandStart, {
        terminalId: data.terminalId,
        terminalName: data.terminalName,
        jobId: data.jobId,
        command: data.command,
        agentName: data.agentName,
        model: data.model,
        ts,
      });

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle terminal:command:start', error);
      client.emit('error', { message: 'Failed to save command start' });
      return { status: 'error' };
    }
  }
}
