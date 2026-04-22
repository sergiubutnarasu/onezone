import { Injectable, Logger } from '@nestjs/common';
import { AssignTaskPayload, EventCommands, createTaskRoomId } from '@onezone/shared';
import { Server } from 'socket.io';

/**
 * Tracks agentId → socketId for connected agents and owns the logic for
 * sending targeted events to them (e.g. task assignment).
 *
 * The Socket.io server is set by ChatGateway.afterInit() so this service
 * can emit without depending on the gateway.
 */
@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly agentSocketIds = new Map<string, string>();
  /** taskId → socketId of the agent currently assigned to that task */
  private readonly taskAgentSockets = new Map<string, string>();
  private server: Server | undefined;

  setServer(server: Server): void {
    this.server = server;
  }

  register(agentId: string, socketId: string): void {
    this.agentSocketIds.set(agentId, socketId);
  }

  deregister(agentId: string): void {
    this.agentSocketIds.delete(agentId);
  }

  disconnectAgent(agentId: string): void {
    const socketId = this.agentSocketIds.get(agentId);
    if (socketId && this.server) {
      this.logger.log(`Force-disconnecting agent ${agentId} (socket ${socketId})`);
      this.server.to(socketId).disconnectSockets(true);
    }
    this.agentSocketIds.delete(agentId);
  }

  registerTaskSocket(taskId: string, socketId: string): void {
    const existing = this.taskAgentSockets.get(taskId);
    if (existing && existing !== socketId && this.server) {
      this.logger.log(`Evicting previous agent socket ${existing} from task ${taskId}`);
      this.server.to(existing).disconnectSockets(true);
    }
    this.taskAgentSockets.set(taskId, socketId);
  }

  evictTaskAgent(taskId: string): void {
    const existing = this.taskAgentSockets.get(taskId);
    if (existing && this.server) {
      this.logger.log(`Evicting agent socket ${existing} from task ${taskId} (reassignment)`);
      this.server.to(existing).disconnectSockets(true);
    }
  }

  deregisterTaskSocket(taskId: string, socketId: string): void {
    if (this.taskAgentSockets.get(taskId) === socketId) {
      this.taskAgentSockets.delete(taskId);
    }
  }

  cleanupTaskRoom(taskId: string): void {
    if (!this.server) return;
    const roomId = createTaskRoomId(taskId);
    this.server.to(roomId).emit(EventCommands.TaskDeleted, { taskId });
    this.server.in(roomId).disconnectSockets(true);
    this.taskAgentSockets.delete(taskId);
    this.logger.log(`Cleaned up room for deleted task ${taskId}`);
  }

  getSocketId(agentId: string): string | undefined {
    return this.agentSocketIds.get(agentId);
  }

  assignTask(agentId: string, taskId: string): boolean {
    const socketId = this.agentSocketIds.get(agentId);
    if (!socketId || !this.server) {
      this.logger.warn(`assignTask: agent ${agentId} is not connected`);
      return false;
    }
    const payload: AssignTaskPayload = { agentId, taskId };
    this.server.to(socketId).emit(EventCommands.AssignTask, payload);
    this.logger.log(`Assigned task ${taskId} to agent ${agentId}`);
    return true;
  }
}
