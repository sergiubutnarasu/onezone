import {
  createClaudeSettings,
  createProjectConfigFolder,
  createProjectFolder,
  createProjectWorkDirFolder,
  getProjectFolder,
  getProjectWorkDir,
} from "./project-paths.js";
import type { TaskJobConfig } from "./types.js";

export const setupProject = (payload: unknown): TaskJobConfig | null => {
  if (!payload || typeof payload !== "object" || !("task" in payload)) {
    return null;
  }

  const task = (payload as { task?: unknown }).task;

  if (!task || typeof task !== "object") {
    return null;
  }

  const project = (task as { project?: unknown }).project;

  if (!project || typeof project !== "object") {
    return null;
  }

  const projectId = (project as { id?: unknown }).id;

  if (!projectId || typeof projectId !== "string") {
    return null;
  }

  const taskId = (task as { id?: unknown }).id;

  if (!taskId || typeof taskId !== "string") {
    return null;
  }

  const hasProjectFolder = createProjectFolder(projectId);

  if (!hasProjectFolder) {
    return null;
  }

  const hasConfigFolder = createProjectConfigFolder(projectId);

  if (!hasConfigFolder) {
    return null;
  }

  const hasWorkDirFolder = createProjectWorkDirFolder(projectId);

  if (!hasWorkDirFolder) {
    return null;
  }

  createClaudeSettings(projectId);

  return {
    projectId,
    taskId,
    projectFolder: getProjectFolder(projectId),
    projectWorkDir: getProjectWorkDir(projectId),
  };
};
