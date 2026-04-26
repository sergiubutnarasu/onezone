// apps/web/src/lib/api.ts

import { TaskStatus, type Terminal, type Task, type RoomMessage } from '@onezone/shared';
import { httpClient } from './http-client';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  defaultAgentId: string;
  defaultAgent: Agent;
  defaultModel: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  tag: string;
  model: string;
  createdAt: string;
}

export interface TaskOrderItem {
  id: string;
  status: TaskStatus;
  order: number;
}

export const fetchProjects = () => httpClient.get<Project[]>('/projects');

export const createProject = (data: { name: string; description?: string; defaultAgentId?: string; defaultModel?: string }) =>
  httpClient.post<Project>('/projects', data);

export const updateProject = (id: string, data: { name?: string; description?: string; defaultAgentId?: string | null; defaultModel?: string | null }) =>
  httpClient.patch<Project>(`/projects/${id}`, data);

export const deleteProject = (id: string) => httpClient.delete<void>(`/projects/${id}`);

export const fetchProject = (id: string) => httpClient.get<Project>(`/projects/${id}`);

export const fetchAgents = () => httpClient.get<Agent[]>('/agents');

export const updateAgent = (id: string, data: { model: string }) =>
  httpClient.patch<Agent>(`/agents/${id}`, data);

export const fetchTasks = (projectId: string) =>
  httpClient.get<Task[]>(`/projects/${projectId}/tasks`);

export const createTask = (
  projectId: string,
  data: { name: string; description?: string; terminalId: string; agentId: string; model: string },
) => httpClient.post<Task>(`/projects/${projectId}/tasks`, data);

export const assignTaskTerminal = (taskId: string, terminalId: string) =>
  httpClient.patch<Task>(`/tasks/${taskId}/terminal`, { terminalId });

export const fetchTask = (taskId: string) => httpClient.get<Task>(`/tasks/${taskId}`);

export const fetchMessages = (taskId: string) =>
  httpClient.get<RoomMessage[]>(`/tasks/${taskId}/messages`);

export const updateTaskStatus = (taskId: string, status: TaskStatus) =>
  httpClient.patch<Task>(`/tasks/${taskId}/status`, { status });

export const updateTask = (taskId: string, data: { name?: string; description?: string; status?: TaskStatus; agentId?: string; model?: string }) =>
  httpClient.patch<Task>(`/tasks/${taskId}`, data);

export const fetchTerminals = () => httpClient.get<Terminal[]>('/terminals');

export const deleteTerminal = (terminalId: string) => httpClient.delete<void>(`/terminals/${terminalId}`);

export const deleteTask = (taskId: string) => httpClient.delete<void>(`/tasks/${taskId}`);

export const reorderTasks = (projectId: string, tasks: TaskOrderItem[]) =>
  httpClient.put<Task[]>(`/projects/${projectId}/tasks/reorder`, { tasks });
