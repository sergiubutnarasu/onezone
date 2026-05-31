// apps/web/src/lib/api.ts

import {
  type Agent,
  type KanbanColumn,
  type Notification,
  type Paginated,
  ProjectInfo,
  type ProjectSkill,
  type RoomMessage,
  type Task,
  type TaskSchedule,
  type Terminal,
} from "@onezone/shared";
import { httpClient, API_BASE } from "./http-client";
export type {
  Agent,
  KanbanColumn,
  ProjectInfo as Project,
} from "@onezone/shared";

// ─── Auth types ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export function safeReturnTo(value: string | null): string {
  // Only accept relative paths — prevents open redirect to external domains.
  // A single leading '/' (not '//') is always same-origin with router.push().
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const login = (email: string, password: string) =>
  authRequest<{ access_token: string; refresh_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const register = (email: string, password: string, name: string) =>
  authRequest<{ access_token: string; refresh_token: string; message?: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });

export const logout = () =>
  authRequest<void>('/auth/logout', { method: 'POST' });

export const getMe = () => authRequest<AuthUser>('/auth/me');

export const activateDevice = (user_code: string) =>
  httpClient.post<{ approved: boolean }>('/auth/activate', { user_code });

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

export const exportProject = (id: string) =>
  httpClient.get<ProjectExportConfig>(`/projects/${id}/export`);

export const importProject = (config: ProjectExportConfig) =>
  httpClient.post<ProjectInfo>('/projects/import', config);

export const fetchProject = (id: string) =>
  httpClient.get<ProjectInfo>(`/projects/${id}`);

export const fetchProjectCostStats = (id: string) =>
  httpClient.get<{ inputTokens: number; outputTokens: number; costUsd: number }>(`/projects/${id}/cost-stats`);

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

// Notifications
export const fetchNotifications = (includeRead = false, page = 1, limit = 20) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (includeRead) params.set('includeRead', 'true');
  return httpClient.get<Paginated<Notification>>(`/notifications?${params}`);
};
export type { Paginated };

export const fetchUnreadCount = () =>
  httpClient.get<number>("/notifications/unread-count");

export const markNotificationRead = (id: string) =>
  httpClient.patch<Notification>(`/notifications/${id}/read`, {});

export const markAllNotificationsRead = () =>
  httpClient.patch<void>("/notifications/read-all", {});

export const removeGlobalSkill = (skillId: string) =>
  httpClient.delete<void>(`/skills/${skillId}`);

// Task schedules
export const fetchSchedules = (projectId: string) =>
  httpClient.get<TaskSchedule[]>(`/projects/${projectId}/schedules`);

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

export const createSchedule = (projectId: string, data: ScheduleInput) =>
  httpClient.post<TaskSchedule>(`/projects/${projectId}/schedules`, data);

export const updateSchedule = (id: string, data: Partial<ScheduleInput>) =>
  httpClient.patch<TaskSchedule>(`/schedules/${id}`, data);

export const deleteSchedule = (id: string) =>
  httpClient.delete<void>(`/schedules/${id}`);

export const runScheduleNow = (id: string) =>
  httpClient.post<TaskSchedule>(`/schedules/${id}/run`, {});
