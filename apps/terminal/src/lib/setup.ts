import {
  cloneProjectRepo,
  createClaudeSettings,
  createProjectConfigFolder,
  createProjectFolder,
  createProjectWorkDirFolder,
  getProjectFolder,
  getProjectWorkDir,
} from "./project-paths.js";
import type { TaskJobConfig } from "./types.js";

export const setupProject = (
  payload: unknown,
  emit?: (message: string) => void,
): TaskJobConfig | null => {
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

  const repository = (project as { repository?: unknown }).repository;

  const taskId = (task as { id?: unknown }).id;

  if (!taskId || typeof taskId !== "string") {
    return null;
  }

  emit?.("Setting up project environment...");

  emit?.("Checking project folder...");
  const hasProjectFolder = createProjectFolder(projectId);
  if (!hasProjectFolder) {
    emit?.("✖ Failed to create project folder.");
    return null;
  }
  emit?.(`✔ Project folder ready: ${getProjectFolder(projectId)}`);

  emit?.("Checking config folder...");
  const hasConfigFolder = createProjectConfigFolder(projectId);
  if (!hasConfigFolder) {
    emit?.("✖ Failed to create config folder.");
    return null;
  }
  emit?.("✔ Config folder ready.");

  emit?.("Checking workdir...");
  const hasWorkDirFolder = createProjectWorkDirFolder(projectId);
  if (!hasWorkDirFolder) {
    emit?.("✖ Failed to create workdir folder.");
    return null;
  }
  emit?.(`✔ Workdir ready: ${getProjectWorkDir(projectId)}`);

  if (repository && typeof repository === "string") {
    emit?.("Checking repository...");
    const cloned = cloneProjectRepo(projectId, repository);
    if (!cloned) {
      emit?.("✖ Failed to clone repository.");
      return null;
    }
    emit?.("✔ Repository ready.");
  }

  emit?.("Checking Claude configuration...");
  createClaudeSettings(projectId);
  emit?.("✔ Claude configuration ready.");

  return {
    projectId,
    taskId,
    projectFolder: getProjectFolder(projectId),
    projectWorkDir: getProjectWorkDir(projectId),
  };
};
