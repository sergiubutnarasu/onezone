import type { Agent } from "./agent.js";

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
  defaultAgent?: Pick<Agent, "id" | "name" | "tag"> | null;
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
