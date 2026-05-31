// packages/shared/src/types.ts

export interface AuthUser {
  id: string;
  email: string;
}

export enum EventCommands {
  ChatMessage = "chat:message",
  OutputLine = "output:line",
  TerminalConnected = "terminal:connected",
  TerminalDisconnected = "terminal:disconnected",
  TerminalCommandStart = "terminal:command:start",
  TerminalCommandExit = "terminal:command:exit",
  TerminalCommandRun = "terminal:command:run",
  TerminalCommandStop = "terminal:command:stop",
  TerminalHeartbeat = "terminal:heartbeat",
  AssignTask = "terminal:assign-task",
  TaskDeleted = "task:deleted",
  TaskColumnUpdated = "task:column-updated",
  NotificationCreated = "notification:created",
  ProjectCostUpdated = "project:cost-updated",
}

export enum MessageRole {
  User = "user",
  Terminal = "terminal",
  System = "system",
}

export enum MessageStream {
  Stdout = "stdout",
  Stderr = "stderr",
}

export enum MessageType {
  Chat = "CHAT",
  CommandStart = "COMMAND_START",
  CommandExit = "COMMAND_EXIT",
}

export enum AgentTag {
  ClaudeCode = "claude-code",
  CopilotCLI = "copilot-cli",
}

/** Sentinel ID used in the UI to represent the virtual "Backlog" column (no DB entry). */
export const BACKLOG_COLUMN_ID = "__backlog__";

/** Sentinel ID used in the UI to represent the virtual "Completed" column (no DB entry). */
export const COMPLETED_COLUMN_ID = "__completed__";

export interface KanbanColumn {
  id: string;
  projectId: string;
  name: string;
  instructions: string;
  index: number;
  agentId?: string | null;
  agent?: Pick<Agent, "id" | "name" | "tag"> | null;
  model?: string | null;
  createdAt: string;
}

export interface ProjectSkill {
  id: string;
  source: string;
  skillName: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string | null;
  repository?: string | null;
  defaultAgentId: string;
  defaultModel: string;
  skills: ProjectSkill[];
  createdAt: string;
  kanbanColumns: KanbanColumn[];
}

export interface ProjectStatisticsSummary {
  tasksDone: number;
  totalTasks: number;
  jobsSucceeded: number;
  jobsFailed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ProjectStatisticsRow extends ProjectStatisticsSummary {
  projectId: string;
  projectName: string;
}

export interface ProjectStatistics {
  totals: ProjectStatisticsSummary;
  projects: ProjectStatisticsRow[];
}

export interface Agent {
  id: string;
  name: string;
  tag: AgentTag;
  model: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  /** null means the task is in the virtual Backlog column */
  columnId: string | null;
  order: number;
  terminal?: Pick<Terminal, "id" | "name" | "isConnected"> | null;
  agentId: string;
  agent?: Pick<Agent, "id" | "name" | "tag"> | null;
  model: string;
  useTaskAgentAndModel: boolean;
  project?: ProjectInfo | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface AssignTaskPayload {
  terminalId: string;
  task: TaskDetails;
}

export interface RunSkillCommandPayload {
  projectId: string;
  source: string;
  skillName: string;
}

export interface Terminal {
  id: string;
  name: string;
  hostname: string;
  isConnected: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  pendingTaskCount?: number;
}

// --- Chat message ---

export interface TaskDetails {
  id: string;
  name: string;
  description?: string | null;
  /** null means the task is in the virtual Backlog column */
  columnId: string | null;
  agentId: string;
  agent?: Pick<Agent, "id" | "name" | "tag"> | null;
  model: string;
  useTaskAgentAndModel: boolean;
  completedAt?: string | null;
  projectId: string;
  project: ProjectInfo;
  column: KanbanColumn | null;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  task?: TaskDetails | null;
}

// --- Task schedules ---

export interface TaskSchedule {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  cronExpression: string;
  timezone?: string | null;
  startColumnId: string;
  startColumn?: Pick<KanbanColumn, "id" | "name"> | null;
  terminalId: string;
  terminal?: Pick<Terminal, "id" | "name"> | null;
  agentId: string;
  agent?: Pick<Agent, "id" | "name" | "tag"> | null;
  model: string;
  useScheduleAgentAndModel: boolean;
  enabled: boolean;
  runOnce: boolean;
  lastRunAt?: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Predefined cron expressions for the UI. */
export const CRON_PRESETS: { label: string; value: string }[] = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
];

// --- Pagination ---

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// --- Notifications ---

export type NotificationType = 'TASK_COMPLETED' | 'COMMAND_START' | 'COMMAND_EXIT_SUCCESS' | 'COMMAND_EXIT_FAILURE';

export interface Notification {
  id: string;
  type: NotificationType;
  taskId: string;
  task: { id: string; name: string };
  projectId: string;
  project: { id: string; name: string };
  message: string;
  readAt: string | null;
  createdAt: string;
}

// --- Socket event payloads ---

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

// --- Typed socket event maps ---

export interface ServerToClientEvents {
  [EventCommands.ChatMessage]: (message: ChatMessage) => void;
  [EventCommands.TerminalCommandRun]: (message: ChatMessage) => void;
  [EventCommands.TerminalConnected]: (payload: {
    terminalId: string;
    terminalName: string;
  }) => void;
  [EventCommands.TerminalDisconnected]: (payload: {
    terminalId: string;
  }) => void;
  [EventCommands.AssignTask]: (payload: AssignTaskPayload) => void;
  [EventCommands.TaskDeleted]: (payload: { taskId: string }) => void;
  [EventCommands.TaskColumnUpdated]: (task: TaskDetails) => void;
  [EventCommands.TerminalCommandStop]: (payload: { jobId: string }) => void;
}

export interface ClientToServerEvents {
  [EventCommands.TerminalCommandStart]: (payload: CommandStartPayload) => void;
  [EventCommands.OutputLine]: (payload: OutputLinePayload) => void;
  [EventCommands.TerminalCommandExit]: (payload: CommandExitPayload) => void;
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
