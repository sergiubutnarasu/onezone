// apps/server/src/gateways/message-handlers/command-start.handler.ts

import { Injectable, Logger } from '@nestjs/common';
import { EventCommands, MessageRole } from '@onezone/shared';
import { MessageType, NotificationType } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { TasksService } from '../../tasks/tasks.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { extractTaskId } from '@onezone/shared';
import { IMessageHandler } from './message-handler.interface';

interface RunnerPayload {
  taskName?: string;
  kanbanColumnName?: string;
}

function parseRunnerCommand(command: string): RunnerPayload | null {
  const match = command.match(/^\/onezone-runner\s+(\{.+\})$/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as RunnerPayload;
  } catch {
    return null;
  }
}

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

  constructor(
    private readonly messagesService: MessagesService,
    private readonly tasksService: TasksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(
    data: CommandStartData,
    client: Socket,
    server?: Server,
    userId?: string,
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
        userId: userId ?? (client.data as { userId?: string }).userId ?? '',
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

      if (taskId) {
        try {
          const task = await this.tasksService.findOne(taskId);
          const runnerPayload = parseRunnerCommand(data.command);
          const columnName = runnerPayload?.kanbanColumnName ?? data.command;
          const taskName = runnerPayload?.taskName ?? task.name;
          const notif = await this.notificationsService.create({
            type: NotificationType.COMMAND_START,
            taskId,
            projectId: task.project!.id,
            message: `Command "${columnName}" for task "${taskName}" started.`,
          });
          server?.emit(EventCommands.NotificationCreated, notif);
        } catch (e) {
          this.logger.warn(`Failed to create command start notification for task ${taskId}`, e);
        }
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle terminal:command:start', error);
      client.emit('error', { message: 'Failed to save command start' });
      return { status: 'error' };
    }
  }
}
