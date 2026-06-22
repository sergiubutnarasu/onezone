import { Injectable, Logger } from "@nestjs/common";
import {
  AssignTaskPayload,
  ChatMessage,
  EventCommands,
  TaskDetails,
  createTaskRoomId,
  createProjectRoomId,
} from "@onezone/shared";
import { Server } from "socket.io";

/**
 * Tracks terminalId → socketId for connected terminals and owns the logic for
 * sending targeted events to them (e.g. task assignment).
 *
 * The Socket.io server is set by ChatGateway.afterInit() so this service
 * can emit without depending on the gateway.
 */
@Injectable()
export class TerminalRegistryService {
  private readonly logger = new Logger(TerminalRegistryService.name);
  private readonly terminalSocketIds = new Map<string, string>();
  /** taskId → socketId of the terminal currently assigned to that task */
  private readonly taskTerminalSockets = new Map<string, string>();
  /** taskId → jobIds requested to stop while the task terminal socket reconnects */
  private readonly pendingStopCommands = new Map<string, Set<string>>();
  private server: Server | undefined;

  setServer(server: Server): void {
    this.server = server;
  }

  register(terminalId: string, socketId: string): void {
    this.terminalSocketIds.set(terminalId, socketId);
  }

  deregister(terminalId: string): void {
    this.terminalSocketIds.delete(terminalId);
  }

  disconnectTerminal(terminalId: string): void {
    const socketId = this.terminalSocketIds.get(terminalId);
    if (socketId && this.server) {
      this.logger.log(
        `Force-disconnecting terminal ${terminalId} (socket ${socketId})`,
      );
      this.server.to(socketId).disconnectSockets(true);
    }
    this.terminalSocketIds.delete(terminalId);
  }

  registerTaskSocket(taskId: string, socketId: string): void {
    const existing = this.taskTerminalSockets.get(taskId);
    if (existing && existing !== socketId && this.server) {
      this.logger.log(
        `Evicting previous terminal socket ${existing} from task ${taskId}`,
      );
      this.server.to(existing).disconnectSockets(true);
    }
    this.taskTerminalSockets.set(taskId, socketId);
    this.flushPendingStopCommands(taskId, socketId);
  }

  evictTaskTerminal(taskId: string): void {
    const existing = this.taskTerminalSockets.get(taskId);
    if (existing && this.server) {
      this.logger.log(
        `Evicting terminal socket ${existing} from task ${taskId} (reassignment)`,
      );
      this.server.to(existing).disconnectSockets(true);
    }
  }

  disconnectTaskTerminal(taskId: string): void {
    const existing = this.taskTerminalSockets.get(taskId);
    if (existing && this.server) {
      this.logger.log(
        `Disconnecting terminal socket ${existing} from completed task ${taskId}`,
      );
      this.server.to(existing).disconnectSockets(true);
    }
    this.taskTerminalSockets.delete(taskId);
  }

  deregisterTaskSocket(taskId: string, socketId: string): void {
    if (this.taskTerminalSockets.get(taskId) === socketId) {
      this.taskTerminalSockets.delete(taskId);
    }
  }

  cleanupTaskRoom(taskId: string): void {
    if (!this.server) return;
    const roomId = createTaskRoomId(taskId);
    this.server.to(roomId).emit(EventCommands.TaskDeleted, { taskId });
    this.server.in(roomId).disconnectSockets(true);
    this.taskTerminalSockets.delete(taskId);
    this.pendingStopCommands.delete(taskId);
    this.logger.log(`Cleaned up room for deleted task ${taskId}`);
  }

  getSocketId(terminalId: string): string | undefined {
    return this.terminalSocketIds.get(terminalId);
  }

  assignTask(terminalId: string, task: TaskDetails): boolean {
    const socketId = this.terminalSocketIds.get(terminalId);
    if (!socketId || !this.server) {
      this.logger.warn(`assignTask: terminal ${terminalId} is not connected`);
      return false;
    }
    const payload: AssignTaskPayload = { terminalId, task };
    this.server.to(socketId).emit(EventCommands.AssignTask, payload);
    this.logger.log(`Assigned task ${task.id} to terminal ${terminalId}`);
    return true;
  }

  notifyTaskColumnUpdated(taskId: string, message: ChatMessage): void {
    if (!this.server) return;
    const roomId = createTaskRoomId(taskId);
    this.server.to(roomId).emit(EventCommands.TaskColumnUpdated, message);
    const projectId = message.task?.project?.id;
    if (projectId) {
      const projectRoomId = createProjectRoomId(projectId);
      this.server.to(projectRoomId).emit(EventCommands.TaskColumnUpdated, message);
    }
    this.logger.log(
      `Notified task room ${roomId} of column update: ${message?.task?.column?.name ?? 'Backlog'}`,
    );
  }

  notifyCommandExit(
    taskId: string,
    payload: {
      roomId: string;
      terminalId: string;
      jobId: string;
      command: string;
      exitCode: number;
      ts: number;
    },
  ): void {
    if (!this.server) return;
    this.server.to(createTaskRoomId(taskId)).emit(EventCommands.TerminalCommandExit, payload);
  }

  /**
   * Sends a saved user chat message as a command-run request to the terminal
   * socket assigned to this task. Returns false when no terminal is live.
   */
  forwardCommandRunToTerminal(taskId: string, message: unknown): boolean {
    const socketId = this.taskTerminalSockets.get(taskId);
    if (!socketId || !this.server) {
      this.logger.warn(
        `forwardCommandRunToTerminal: no task terminal socket for ${taskId}`,
      );
      return false;
    }
    this.server.to(socketId).emit(EventCommands.TerminalCommandRun, message);
    return true;
  }

  forwardStopCommandToTerminal(taskId: string, jobId: string): boolean {
    const socketId = this.taskTerminalSockets.get(taskId);
    if (!socketId || !this.server || !this.isSocketConnected(socketId)) {
      this.queueStopCommand(taskId, jobId);
      this.logger.warn(
        `forwardStopCommandToTerminal: queued stop for job ${jobId} on task ${taskId}; no task terminal socket is connected`,
      );
      return false;
    }
    this.server.to(socketId).emit(EventCommands.TerminalCommandStop, { jobId });
    return true;
  }

  private queueStopCommand(taskId: string, jobId: string): void {
    const pending = this.pendingStopCommands.get(taskId) ?? new Set<string>();
    pending.add(jobId);
    this.pendingStopCommands.set(taskId, pending);
  }

  private flushPendingStopCommands(taskId: string, socketId: string): void {
    if (!this.server) return;
    const pending = this.pendingStopCommands.get(taskId);
    if (!pending || pending.size === 0) return;

    for (const jobId of pending) {
      this.server.to(socketId).emit(EventCommands.TerminalCommandStop, { jobId });
    }
    this.pendingStopCommands.delete(taskId);
    this.logger.log(
      `Forwarded ${pending.size} queued stop command(s) to task ${taskId}`,
    );
  }

  private isSocketConnected(socketId: string): boolean {
    const adapter = (
      this.server as { adapter?: { rooms?: Map<string, Set<string>> } } | undefined
    )?.adapter;
    return adapter?.rooms?.has(socketId) ?? false;
  }
}
