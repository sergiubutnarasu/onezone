export enum EventCommands {
  ChatMessage = "chat:message",
  OutputLine = "output:line",
  AgentConnected = "agent:connected",
  AgentDisconnected = "agent:disconnected",
  AgentCommandStart = "agent:command:start",
  AgentCommandExit = "agent:command:exit",
  AgentHeartbeat = "agent:heartbeat",
}

export enum MessageRole {
  User = "user",
  Agent = "agent",
  System = "system",
}

export enum MessageStream {
  Stdout = "stdout",
  Stderr = "stderr",
}

export enum MessageType {
  CommandStart = "COMMAND_START",
  CommandExit = "COMMAND_EXIT",
}

export enum TaskStatus {
  BACKLOG = "BACKLOG",
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  TESTING = "TESTING",
  DONE = "DONE",
}

export const TASK_STATUS_COLUMNS = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.TESTING,
  TaskStatus.DONE,
] as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "Backlog",
  [TaskStatus.TODO]: "To Do",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.IN_REVIEW]: "In Review",
  [TaskStatus.TESTING]: "Testing",
  [TaskStatus.DONE]: "Done",
};

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  status: TaskStatus;
  order: number;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  hostname: string;
  isConnected: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

// --- Chat message ---

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// --- Socket event payloads ---

export interface CommandStartPayload {
  roomId: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
}

export interface OutputLinePayload {
  roomId: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
  stream: MessageStream;
  content: string;
}

export interface CommandExitPayload {
  roomId: string;
  agentId: string;
  jobId: string;
  command: string;
  exitCode: number;
}

// --- Typed socket event maps ---

export interface ServerToClientEvents {
  [EventCommands.ChatMessage]: (message: ChatMessage) => void;
  [EventCommands.AgentConnected]: (payload: { agentId: string; agentName: string }) => void;
  [EventCommands.AgentDisconnected]: (payload: { agentId: string }) => void;
}

export interface ClientToServerEvents {
  [EventCommands.AgentCommandStart]: (payload: CommandStartPayload) => void;
  [EventCommands.OutputLine]: (payload: OutputLinePayload) => void;
  [EventCommands.AgentCommandExit]: (payload: CommandExitPayload) => void;
  [EventCommands.AgentHeartbeat]: () => void;
}
