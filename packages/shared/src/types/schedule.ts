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

/** Predefined cron expressions for the UI. */
export const CRON_PRESETS: { label: string; value: string }[] = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 3 minutes", value: "*/3 * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 10 minutes", value: "*/10 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 25 minutes", value: "*/25 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 3 hours", value: "0 */3 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
];
