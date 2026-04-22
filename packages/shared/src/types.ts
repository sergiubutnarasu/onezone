// packages/shared/src/types.ts

export enum EventCommands {
  ChatMessage = "chat:message",
  OutputLine = "output:line",
  AgentConnected = "agent:connected",
  AgentDisconnected = "agent:disconnected",
  AgentCommandStart = "agent:command:start",
  AgentCommandExit = "agent:command:exit",
  AgentHeartbeat = "agent:heartbeat",
  AssignTask = "agent:assign-task",
  TaskDeleted = "task:deleted",
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
  agentId: string;
  agent?: Pick<Agent, "id" | "name"> | null;
  createdAt: string;
}

export interface AssignTaskPayload {
  agentId: string;
  taskId: string;
}

export interface Agent {
  id: string;
  name: string;
  hostname: string;
  isConnected: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  pendingTaskCount?: number;
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
  [EventCommands.AgentConnected]: (payload: {
    agentId: string;
    agentName: string;
  }) => void;
  [EventCommands.AgentDisconnected]: (payload: { agentId: string }) => void;
  [EventCommands.AssignTask]: (payload: AssignTaskPayload) => void;
  [EventCommands.TaskDeleted]: (payload: { taskId: string }) => void;
}

export interface ClientToServerEvents {
  [EventCommands.AgentCommandStart]: (payload: CommandStartPayload) => void;
  [EventCommands.OutputLine]: (payload: OutputLinePayload) => void;
  [EventCommands.AgentCommandExit]: (payload: CommandExitPayload) => void;
  [EventCommands.AgentHeartbeat]: () => void;
}

// --- Discriminated union for room messages (used by web frontend) ---

interface BaseRoomMessage {
  id?: string;
  roomId: string;
  ts: number;
}

export interface UserChatMessage extends BaseRoomMessage {
  role: 'user';
  content: string;
  agentId?: null;
  agentName?: null;
  jobId?: null;
  command?: null;
  stream?: null;
  exitCode?: null;
  messageType?: null;
}

export interface AgentOutputMessage extends BaseRoomMessage {
  role: 'agent';
  content: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
  stream: 'stdout' | 'stderr';
  exitCode?: null;
  messageType?: null;
}

export interface CommandStartMessage extends BaseRoomMessage {
  role: 'system';
  messageType: MessageType.CommandStart;
  content: string;
  agentId: string;
  agentName: string;
  jobId: string;
  command: string;
  stream?: null;
  exitCode?: null;
}

export interface CommandExitMessage extends BaseRoomMessage {
  role: 'system';
  messageType?: MessageType.CommandExit | null;
  content: string;
  agentId: string;
  agentName?: string | null;
  jobId: string;
  command: string;
  exitCode: number;
  stream?: null;
}

export interface SystemNoticeMessage extends BaseRoomMessage {
  role: 'system';
  content: string;
  agentId?: string | null;
  agentName?: string | null;
  jobId?: null;
  command?: null;
  stream?: null;
  exitCode?: null;
  messageType?: null;
}

export type RoomMessage =
  | UserChatMessage
  | AgentOutputMessage
  | CommandStartMessage
  | CommandExitMessage
  | SystemNoticeMessage;
