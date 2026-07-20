import type { EventCommands, MessageStream, MessageType } from "./enums.js";
import type { AssignTaskPayload, ProjectBuilderCommandFinishedPayload, ProjectBuilderCommandPayload, ProjectBuilderCommandStopPayload, TaskDetails } from "./task.js";

export interface CommandStartPayload {
  roomId: string;
  terminalId: string;
  terminalName: string;
  jobId: string;
  command: string;
}

export interface OutputLinePayload {
  roomId: string;
  terminalId: string;
  terminalName: string;
  jobId: string;
  command: string;
  stream: MessageStream;
  content: string;
}

export interface CommandExitPayload {
  roomId: string;
  terminalId: string;
  jobId: string;
  command: string;
  exitCode: number;
  /** Present when the process produced a result (i.e. was a task runner invocation). */
  taskRunnerFinished?: boolean;
  /** The next column UUID, null for backlog, undefined if no ONEZONE_NEXT_COLUMN signal was emitted. */
  nextColumnId?: string | null;
}

export interface ServerToClientEvents {
  [EventCommands.ChatMessage]: (message: import("./task.js").ChatMessage) => void;
  [EventCommands.TerminalCommandRun]: (message: import("./task.js").ChatMessage) => void;
  [EventCommands.TerminalConnected]: (payload: {
    terminalId: string;
    terminalName: string;
  }) => void;
  [EventCommands.TerminalDisconnected]: (payload: {
    terminalId: string;
  }) => void;
  [EventCommands.AssignTask]: (payload: AssignTaskPayload) => void;
  [EventCommands.ProjectBuilderCommand]: (payload: ProjectBuilderCommandPayload) => void;
  [EventCommands.ProjectBuilderCommandStop]: (payload: ProjectBuilderCommandStopPayload) => void;
  [EventCommands.ProjectBuilderCommandFinished]: (payload: ProjectBuilderCommandFinishedPayload) => void;
  [EventCommands.TaskDeleted]: (payload: { taskId: string }) => void;
  [EventCommands.TaskColumnUpdated]: (task: TaskDetails) => void;
  [EventCommands.TerminalCommandStop]: (payload: { jobId: string }) => void;
}

export interface ClientToServerEvents {
  [EventCommands.TerminalCommandStart]: (payload: CommandStartPayload) => void;
  [EventCommands.OutputLine]: (payload: OutputLinePayload) => void;
  [EventCommands.TerminalCommandExit]: (payload: CommandExitPayload) => void;
  [EventCommands.ProjectBuilderCommandFinished]: (payload: ProjectBuilderCommandFinishedPayload) => void;
  [EventCommands.TerminalHeartbeat]: () => void;
}

// --- Discriminated union for room messages (used by web frontend) ---

interface BaseRoomMessage {
  id?: string;
  roomId: string;
  ts: number;
}

export interface UserChatMessage extends BaseRoomMessage {
  role: "user";
  content: string;
  terminalId?: null;
  terminalName?: null;
  messageType: MessageType.Chat;
  jobId?: null;
  command?: null;
  stream?: null;
  exitCode?: null;
}

export interface TerminalOutputMessage extends BaseRoomMessage {
  role: "terminal";
  content: string;
  terminalId: string;
  terminalName: string;
  jobId: string;
  command: string;
  stream: "stdout" | "stderr";
  exitCode?: null;
  messageType?: null;
}

export interface CommandStartMessage extends BaseRoomMessage {
  role: "system";
  messageType: MessageType.CommandStart;
  content: string;
  terminalId: string;
  terminalName: string;
  jobId: string;
  command: string;
  stream?: null;
  exitCode?: null;
}

export interface CommandExitMessage extends BaseRoomMessage {
  role: "system";
  messageType?: MessageType.CommandExit | null;
  content: string;
  terminalId: string;
  terminalName?: string | null;
  jobId: string;
  command: string;
  exitCode: number;
  stream?: null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalCostUsd?: number | null;
}

export interface SystemNoticeMessage extends BaseRoomMessage {
  role: "system";
  content: string;
  terminalId?: string | null;
  terminalName?: string | null;
  jobId?: null;
  command?: null;
  stream?: null;
  exitCode?: null;
  messageType?: null;
}

export type RoomMessage =
  | UserChatMessage
  | TerminalOutputMessage
  | CommandStartMessage
  | CommandExitMessage
  | SystemNoticeMessage;
