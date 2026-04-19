import { MessageRole } from '@onezone/shared';
import { io, Socket } from 'socket.io-client';

export interface AgentSocketOptions {
  serverUrl: string;
  taskId: string;
  agentId: string;
  agentName: string;
}

export function createAgentSocket(options: AgentSocketOptions): Socket {
  const { serverUrl, taskId, agentId, agentName } = options;

  const socket = io(`${serverUrl}/chat`, {
    auth: {
      taskId,
      role: MessageRole.Agent,
      agentId,
      agentName,
    },
    reconnection: true,
  });

  return socket;
}
