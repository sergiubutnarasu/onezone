import type { Agent } from "./agent.js";
import type { KanbanColumn } from "./project.js";
import type { Terminal } from "./task.js";

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
