// apps/web/src/lib/api.ts

import {
  type Agent,
  type KanbanColumn,
  ProjectInfo,
  type ProjectSkill,
  type RoomMessage,
  type Task,
  type Terminal,
} from "@onezone/shared";
import { httpClient } from "./http-client";
export type {
  Agent,
  KanbanColumn,
  ProjectInfo as Project,
} from "@onezone/shared";

export interface TaskOrderItem {
  id: string;
  /** null means the task moves to the virtual Backlog column */
  columnId: string | null;
  order: number;
}

export const fetchProjects = () => httpClient.get<ProjectInfo[]>("/projects");

export const createProject = (data: {
  name: string;
  description?: string;
  repository?: string;
  defaultAgentId?: string;
  defaultModel?: string;
}) => httpClient.post<ProjectInfo>("/projects", data);

export const updateProject = (
  id: string,
  data: {
    name?: string;
    description?: string;
    repository?: string | null;
    defaultAgentId?: string | null;
    defaultModel?: string | null;
  },
) => httpClient.patch<ProjectInfo>(`/projects/${id}`, data);

export const deleteProject = (id: string) =>
  httpClient.delete<void>(`/projects/${id}`);

export const fetchProject = (id: string) =>
  httpClient.get<ProjectInfo>(`/projects/${id}`);

export const fetchAgents = () => httpClient.get<Agent[]>("/agents");

export const updateAgent = (id: string, data: { model: string }) =>
  httpClient.patch<Agent>(`/agents/${id}`, data);

export const fetchTasks = (projectId: string) =>
  httpClient.get<Task[]>(`/projects/${projectId}/tasks`);

export const createTask = (
  projectId: string,
  data: {
    name: string;
    description?: string;
    terminalId: string;
    agentId: string;
    model: string;
    useTaskAgentAndModel?: boolean;
  },
) => httpClient.post<Task>(`/projects/${projectId}/tasks`, data);

export const assignTaskTerminal = (taskId: string, terminalId: string) =>
  httpClient.patch<Task>(`/tasks/${taskId}/terminal`, { terminalId });

export const fetchTask = (taskId: string) =>
  httpClient.get<Task>(`/tasks/${taskId}`);

export const fetchMessages = (taskId: string) =>
  httpClient.get<RoomMessage[]>(`/tasks/${taskId}/messages`);

export const updateTaskColumn = (taskId: string, columnId: string | null) =>
  httpClient.patch<Task>(`/tasks/${taskId}/column`, { columnId });

export const setTaskCompleted = (taskId: string, completed: boolean) =>
  httpClient.patch<Task>(`/tasks/${taskId}/complete`, { completed });

export const updateTask = (
  taskId: string,
  data: {
    name?: string;
    description?: string;
    columnId?: string | null;
    agentId?: string;
    model?: string;
    useTaskAgentAndModel?: boolean;
  },
) => httpClient.patch<Task>(`/tasks/${taskId}`, data);

export const fetchTerminals = () => httpClient.get<Terminal[]>("/terminals");

export const deleteTerminal = (terminalId: string) =>
  httpClient.delete<void>(`/terminals/${terminalId}`);

export const deleteTask = (taskId: string) =>
  httpClient.delete<void>(`/tasks/${taskId}`);

export const reorderTasks = (projectId: string, tasks: TaskOrderItem[]) =>
  httpClient.put<Task[]>(`/projects/${projectId}/tasks/reorder`, { tasks });

export const fetchProjectSkills = (projectId: string) =>
  httpClient.get<ProjectSkill[]>(`/projects/${projectId}/skills`);

export const installProjectSkill = (
  projectId: string,
  data: { source: string; skillName: string },
) => httpClient.post<ProjectSkill>(`/projects/${projectId}/skills`, data);

export const removeProjectSkill = (projectId: string, skillId: string) =>
  httpClient.delete<void>(`/projects/${projectId}/skills/${skillId}`);

// Kanban column CRUD
export const fetchKanbanColumns = (projectId: string) =>
  httpClient.get<KanbanColumn[]>(`/projects/${projectId}/kanban-columns`);

export const createKanbanColumn = (
  projectId: string,
  data: { name: string; instructions?: string; agentId?: string | null; model?: string | null },
) =>
  httpClient.post<KanbanColumn>(`/projects/${projectId}/kanban-columns`, data);

export const updateKanbanColumn = (
  projectId: string,
  columnId: string,
  data: { name?: string; instructions?: string; agentId?: string | null; model?: string | null },
) =>
  httpClient.patch<KanbanColumn>(
    `/projects/${projectId}/kanban-columns/${columnId}`,
    data,
  );

export const deleteKanbanColumn = (projectId: string, columnId: string) =>
  httpClient.delete<void>(`/projects/${projectId}/kanban-columns/${columnId}`);

export const reorderKanbanColumns = (
  projectId: string,
  columns: { id: string; index: number }[],
) =>
  httpClient.put<KanbanColumn[]>(
    `/projects/${projectId}/kanban-columns/reorder`,
    { columns },
  );

export const fetchGlobalSkills = () =>
  httpClient.get<ProjectSkill[]>("/skills");

export const installGlobalSkill = (data: {
  source: string;
  skillName: string;
}) => httpClient.post<ProjectSkill>("/skills", data);

export const removeGlobalSkill = (skillId: string) =>
  httpClient.delete<void>(`/skills/${skillId}`);
