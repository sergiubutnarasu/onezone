export type MessageRole = 'user' | 'agent' | 'system';
export type MessageStream = 'stdout' | 'stderr';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  taskId: string;
  role: MessageRole;
  agentId?: string | null;
  agentName?: string | null;
  jobId?: string | null;
  command?: string | null;
  stream?: MessageStream | null;
  content: string;
  ts: number;
  createdAt: string;
}

export interface AgentInfo {
  agentId: string;
  agentName: string;
  taskId: string;
}
