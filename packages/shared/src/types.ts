export enum EventCommands {
  ChatMessage = "chat:message",
  OutputLine = "output:line",
  AgentConnected = "agent:connected",
  AgentDisconnected = "agent:disconnected",
  AgentCommandStart = "agent:command:start",
  AgentCommandExit = "agent:command:exit",
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
}
