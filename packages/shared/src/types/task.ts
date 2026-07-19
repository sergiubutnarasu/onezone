import type { AgentTag, MessageRole } from "./enums.js";
import type { Agent } from "./agent.js";
import type { KanbanColumn, ProjectInfo } from "./project.js";

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
  /** When true, the task runner executes the task's own instructions only
   * (no kanban column instructions), then marks the task finished after the run. */
  bypass: boolean;
  project?: ProjectInfo | null;
  completedAt?: string | null;
  createdAt: string;
}

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
  bypass: boolean;
  completedAt?: string | null;
  projectId: string;
  project: ProjectInfo;
  column: KanbanColumn | null;
}

export interface AssignTaskPayload {
  terminalId: string;
  task: TaskDetails;
}

export interface RunSkillCommandPayload {
  projectId: string;
  source: string;
  skillName: string;
  agentCode: AgentTag;
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

export interface ChatMessage {
  role: MessageRole;
  content: string;
  task?: TaskDetails | null;
}
