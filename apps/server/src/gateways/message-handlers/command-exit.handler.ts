import { Injectable, Logger } from '@nestjs/common';
import { EventCommands, MessageRole, createProjectRoomId, createUserRoomId, extractTaskId } from '@onezone/shared';
import { MessageType, NotificationType } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../../messages/messages.service';
import { TasksService } from '../../tasks/tasks.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ProjectsService } from '../../projects/projects.service';
import { IMessageHandler } from './message-handler.interface';
import type { CommandExitData } from '../../types';
import { parseRunnerCommand } from '../../libs/runner-command';

@Injectable()
export class CommandExitHandler implements IMessageHandler<CommandExitData> {
  private readonly logger = new Logger(CommandExitHandler.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly tasksService: TasksService,
    private readonly notificationsService: NotificationsService,
    private readonly projectsService: ProjectsService,
  ) {}

  private async applyTaskRunnerCompletion(
    taskId: string,
    data: CommandExitData,
    userId: string,
  ): Promise<void> {
    if (!data.taskRunnerFinished) return;

    const task = await this.tasksService.findOne(taskId, userId);
    if (task.bypass) {
      // Bypass tasks run their own instructions once and are always marked
      // finished after the run, regardless of any next-column signal.
      await this.tasksService.setCompleted(taskId, true, userId);
      return;
    }

    if (data.nextColumnId !== undefined) {
      try {
        await this.tasksService.updateColumn(taskId, data.nextColumnId, userId);
      } catch (e) {
        this.logger.warn(`Column ${data.nextColumnId} not found, marking task ${taskId} as completed`);
        await this.tasksService.setCompleted(taskId, true, userId);
      }
      return;
    }

    // No next-column tag was found in the runner's output. This is only
    // expected when the task is on the last column of the board. If it's not,
    // the agent failed to emit the required signal - leave the task in place
    // (rather than silently marking it complete) so the failure is visible.
    if (await this.tasksService.isTaskOnLastColumn(taskId, userId)) {
      await this.tasksService.setCompleted(taskId, true, userId);
    } else {
      this.logger.warn(
        `Task ${taskId} runner finished without a next-column signal while not on the last column; leaving task in place instead of auto-completing.`,
      );
    }
  }

  private async repairDuplicateTaskRunnerCompletion(
    taskId: string,
    data: CommandExitData,
    userId: string,
  ): Promise<void> {
    if (!data.taskRunnerFinished) return;
    if (data.nextColumnId !== undefined) return;

    const task = await this.tasksService.findOne(taskId, userId);
    if (task.completedAt) return;

    if (task.bypass || (await this.tasksService.isTaskOnLastColumn(taskId, userId))) {
      await this.tasksService.setCompleted(taskId, true, userId);
    }
  }


  async handle(
    data: CommandExitData,
    client: Socket,
    server?: Server,
    userId?: string,
  ): Promise<{ status: 'ok' | 'error' }> {
    try {
      const taskId = extractTaskId(data.roomId);
      const ts = data.ts ?? Date.now();
      const effectiveUserId = userId ?? (client.data as { userId?: string }).userId ?? '';

      const alreadyHandled = await this.messagesService.hasCommandExit(
        taskId,
        data.jobId,
        effectiveUserId,
      );

      if (!alreadyHandled) {
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
          agentId: data.agentId,
          model: data.model,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalCostUsd: data.totalCostUsd,
          userId: effectiveUserId,
          ts,
        });

        server?.to(data.roomId).emit(EventCommands.TerminalCommandExit, {
          terminalId: data.terminalId,
          jobId: data.jobId,
          command: data.command,
          exitCode: data.exitCode,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalCostUsd: data.totalCostUsd,
          ts,
        });
      }

      if (taskId && data.taskRunnerFinished && !alreadyHandled) {
        await this.applyTaskRunnerCompletion(taskId, data, effectiveUserId);
      } else if (taskId && data.taskRunnerFinished) {
        await this.repairDuplicateTaskRunnerCompletion(taskId, data, effectiveUserId);
      }

      if (taskId) {
        try {
          const task = await this.tasksService.findOne(taskId, effectiveUserId);
          const projectId = task.project!.id;
          if (!alreadyHandled) {
            const notifType = data.exitCode === 0
              ? NotificationType.COMMAND_EXIT_SUCCESS
              : NotificationType.COMMAND_EXIT_FAILURE;
            const runnerPayload = parseRunnerCommand(data.command);
            const columnName = runnerPayload?.kanbanColumnName ?? data.command;
            const taskName = runnerPayload?.taskName ?? task.name;
            const message = data.exitCode === 0
              ? `Command "${columnName}" for task "${taskName}" finished.`
              : `Command "${columnName}" for task "${taskName}" failed (exit code: ${data.exitCode}).`;
            const notif = await this.notificationsService.create({
              type: notifType,
              taskId,
              projectId,
              message,
              userId: effectiveUserId,
            });
            server?.to(createUserRoomId(effectiveUserId)).emit(EventCommands.NotificationCreated, notif);
          }

          if (server) {
            try {
              const costStats = await this.projectsService.getCostStats(projectId, effectiveUserId);
              server.to(createProjectRoomId(projectId)).emit(EventCommands.ProjectCostUpdated, costStats);
            } catch (e) {
              this.logger.warn(`Failed to emit project cost update for project ${projectId}`, e);
            }
          }
        } catch (e) {
          this.logger.warn(`Failed to create command exit notification for task ${taskId}`, e);
        }
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to handle terminal:command:exit', error);
      client.emit('error', { message: 'Failed to save command exit' });
      return { status: 'error' };
    }
  }
}
