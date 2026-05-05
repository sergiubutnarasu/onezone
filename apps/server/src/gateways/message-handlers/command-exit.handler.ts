import { Injectable, Logger } from '@nestjs/common';
import { EventCommands, MessageRole } from '@onezone/shared';
import { MessageType } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { extractTaskId } from '@onezone/shared';
import { IMessageHandler } from './message-handler.interface';
import { TasksService } from '../../tasks/tasks.service';

export interface CommandExitData {
  roomId: string;
  terminalId?: string;
  terminalName?: string;
  jobId: string;
  command: string;
  exitCode: number;
  totalCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

@Injectable()
export class CommandExitHandler implements IMessageHandler<CommandExitData> {
  private readonly logger = new Logger(CommandExitHandler.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly tasksService: TasksService,
  ) {}

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
        terminalId: data.terminalId,
        terminalName: data.terminalName,
        messageType: MessageType.COMMAND_EXIT,
        jobId: data.jobId,
        command: data.command,
        exitCode: data.exitCode,
        content: `[${data.terminalId ?? 'terminal'}] exited with code ${data.exitCode}: ${data.command}`,
        ts,
      });

      if (data.totalCostUsd !== undefined || data.inputTokens !== undefined || data.outputTokens !== undefined) {
        await this.tasksService.updateUsage(taskId, {
          totalCostUsd: data.totalCostUsd,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
        });
      }

      server?.to(data.roomId).emit(EventCommands.TerminalCommandExit, {
        terminalId: data.terminalId,
        jobId: data.jobId,
        command: data.command,
        exitCode: data.exitCode,
        ts,
      });

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle terminal:command:exit', error);
      client.emit('error', { message: 'Failed to save command exit' });
      return { status: 'error' };
    }
  }
}
