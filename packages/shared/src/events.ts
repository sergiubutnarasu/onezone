import type { Message, AgentInfo } from './types';

// Events emitted by clients (user or agent) to the server
export interface ClientToServerEvents {
  'chat:message': (payload: {
    roomId: string;
    content: string;
  }) => void;

  'output:line': (payload: {
    roomId: string;
    agentId: string;
    agentName: string;
    jobId?: string;
    command?: string;
    stream: 'stdout' | 'stderr';
    content: string;
  }) => void;

  'agent:connected': (payload: {
    roomId: string;
    agentId: string;
    agentName: string;
  }) => void;

  'agent:command:start': (payload: {
    roomId: string;
    agentId: string;
    agentName: string;
    jobId: string;
    command: string;
  }) => void;

  'agent:command:exit': (payload: {
    roomId: string;
    agentId: string;
    jobId: string;
    command: string;
    exitCode: number;
  }) => void;
}

// Events emitted by the server to clients
export interface ServerToClientEvents {
  'chat:message': (message: Message) => void;
  'output:line': (message: Message) => void;
  'agent:connected': (info: AgentInfo & { ts: number }) => void;
  'agent:disconnected': (info: AgentInfo & { ts: number }) => void;
  'agent:command:start': (payload: { agentId: string; agentName: string; jobId: string; command: string; ts: number }) => void;
  'agent:command:exit': (payload: { agentId: string; jobId: string; command: string; exitCode: number; ts: number }) => void;
}

// Auth data sent in socket handshake
export interface SocketAuth {
  taskId: string;
  role: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
}
