// apps/server/src/gateways/message-handlers/output-line.handler.ts

import { Injectable, Logger } from '@nestjs/common';
import { MessageRole, MessageStream } from '@onezone/shared';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { extractTaskId } from '@onezone/shared';
import { IMessageHandler } from './message-handler.interface';

export interface OutputLineData {
  roomId: string;
  terminalId?: string;
  terminalName?: string;
  jobId?: string;
  command?: string;
  stream: MessageStream;
  content: string;
  ts?: number;
  agentId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

@Injectable()
export class OutputLineHandler implements IMessageHandler<OutputLineData> {
  private readonly logger = new Logger(OutputLineHandler.name);

  constructor(
    private readonly messagesService: MessagesService,
  ) {}

  async handle(
    data: OutputLineData,
    client: Socket,
    server?: Server,
  ): Promise<{ status: 'ok' | 'error' }> {
    try {
      const taskId = extractTaskId(data.roomId);
      const ts = data.ts ?? Date.now();

      const message = await this.messagesService.create({
        roomId: data.roomId,
        taskId,
        role: MessageRole.Terminal,
        terminalId: data.terminalId,
        terminalName: data.terminalName,
        messageType: 'CHAT',
        jobId: data.jobId,
        command: data.command,
        stream: data.stream,
        content: data.content,
        agentId: data.agentId,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        ts,
      });

      server
        ?.to(data.roomId)
        .emit('output:line', {
          ...message,
          ts: Number(message.ts),
          jobId: data.jobId,
          command: data.command,
          stream: data.stream,
        });

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle output:line', error);
      client.emit('error', { message: 'Failed to save output line' });
      return { status: 'error' };
    }
  }
}
