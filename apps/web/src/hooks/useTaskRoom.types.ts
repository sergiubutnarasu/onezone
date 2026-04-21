export interface RoomMessage {
  id?: string;
  roomId: string;
  role: 'user' | 'agent' | 'system';
  agentId?: string | null;
  agentName?: string | null;
  jobId?: string | null;
  command?: string | null;
  stream?: 'stdout' | 'stderr' | null;
  exitCode?: number | null;
  content: string;
  messageType?: string | null;
  ts: number;
}

export interface ConnectedAgent {
  agentId: string;
  agentName: string;
  taskId: string;
}

export type Action =
  | { type: 'SET_MESSAGES'; messages: RoomMessage[] }
  | { type: 'APPEND_MESSAGE'; message: RoomMessage }
  | { type: 'AGENT_CONNECTED'; info: ConnectedAgent & { ts: number } }
  | { type: 'AGENT_DISCONNECTED'; info: { agentId: string; agentName?: string; ts: number } }
  | { type: 'COMMAND_START'; payload: { agentId: string; agentName: string; jobId: string; command: string; ts: number }; taskId: string }
  | { type: 'COMMAND_EXIT'; payload: { agentId: string; jobId: string; command: string; exitCode: number; ts: number }; taskId: string };

export interface State {
  messages: RoomMessage[];
  connectedAgents: Map<string, ConnectedAgent>;
}
