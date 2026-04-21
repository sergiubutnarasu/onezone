import {
  ClientToServerEvents,
  MessageRole,
  ServerToClientEvents,
} from "@onezone/shared";
import { hostname } from "node:os";
import { io, Socket } from "socket.io-client";

export interface AgentSocketOptions {
  serverUrl: string;
  taskId?: string;
  agentId: string;
  agentName: string;
}

export function createAgentSocket(
  options: AgentSocketOptions,
): Socket<ServerToClientEvents, ClientToServerEvents> {
  const { serverUrl, taskId, agentId, agentName } = options;

  const socket = io(`${serverUrl}/chat`, {
    auth: {
      ...(taskId ? { taskId } : {}),
      role: MessageRole.Agent,
      agentId,
      agentName,
      agentHostname: hostname(),
    },
    reconnection: true,
  });

  return socket;
}
