// apps/web/src/lib/api.ts

import { TaskStatus, type Agent, type Task, type RoomMessage } from '@onezone/shared';
import { httpClient } from './http-client';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface TaskOrderItem {
  id: string;
  status: TaskStatus;
  order: number;
}

export const fetchProjects = () => httpClient.get<Project[]>('/projects');

export const createProject = (data: { name: string; description?: string }) =>
  httpClient.post<Project>('/projects', data);

export const deleteProject = (id: string) => httpClient.delete<void>(`/projects/${id}`);

export const fetchProject = (id: string) => httpClient.get<Project>(`/projects/${id}`);

export const fetchTasks = (projectId: string) =>
  httpClient.get<Task[]>(`/projects/${projectId}/tasks`);

export const createTask = (
  projectId: string,
  data: { name: string; description?: string; agentId: string },
) => httpClient.post<Task>(`/projects/${projectId}/tasks`, data);

export const assignTaskAgent = (taskId: string, agentId: string) =>
  httpClient.patch<Task>(`/tasks/${taskId}/agent`, { agentId });

export const fetchTask = (taskId: string) => httpClient.get<Task>(`/tasks/${taskId}`);

export const fetchMessages = (taskId: string) =>
  httpClient.get<RoomMessage[]>(`/tasks/${taskId}/messages`);

export const updateTaskStatus = (taskId: string, status: TaskStatus) =>
  httpClient.patch<Task>(`/tasks/${taskId}/status`, { status });

export const fetchAgents = () => httpClient.get<Agent[]>('/agents');

export const deleteAgent = (agentId: string) => httpClient.delete<void>(`/agents/${agentId}`);

export const deleteTask = (taskId: string) => httpClient.delete<void>(`/tasks/${taskId}`);

export const reorderTasks = (projectId: string, tasks: TaskOrderItem[]) =>
  httpClient.put<Task[]>(`/projects/${projectId}/tasks/reorder`, { tasks });
