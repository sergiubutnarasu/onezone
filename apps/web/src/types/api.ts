/** Shape accepted by POST /projects/import */
export interface ProjectExportConfig {
  version: string;
  name: string;
  description: string | null;
  repository: string | null;
  defaultAgent: string;
  defaultModel: string;
  columns: { name: string; instructions: string; agent: string | null; model: string | null }[];
  skills?: { source: string; skillName: string }[];
}

/** Item sent when reordering tasks inside a project board. */
export interface TaskOrderItem {
  id: string;
  /** null means the task moves to the virtual Backlog column */
  columnId: string | null;
  order: number;
}

/** Payload for creating / updating a task schedule. */
export interface ScheduleInput {
  name: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  startColumnId: string;
  terminalId: string;
  agentId: string;
  model: string;
  useScheduleAgentAndModel?: boolean;
  enabled?: boolean;
  runOnce?: boolean;
}
