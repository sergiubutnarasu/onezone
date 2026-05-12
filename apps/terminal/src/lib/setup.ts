import type { ProjectInfo } from "@onezone/shared";
import {
  cloneProjectRepo,
  createClaudeSettings,
  createProjectConfigFolder,
  createProjectFolder,
  createProjectWorkDirFolder,
  getAllInstalledSkills,
  getProjectFolder,
  getProjectWorkDir,
  removeSkill,
} from "./project-paths.js";
import { setupSkills } from "./skills.js";
import type { TaskJobConfig } from "./types.js";

export const setupProject = async (
  payload: unknown,
  emit?: (message: string) => void,
): Promise<TaskJobConfig | null> => {
  if (!payload || typeof payload !== "object" || !("task" in payload)) {
    return null;
  }

  const task = (payload as { task?: unknown }).task;

  if (!task || typeof task !== "object") {
    return null;
  }

  const project = (task as { project?: unknown }).project as ProjectInfo;

  if (!project || typeof project !== "object") {
    return null;
  }

  const projectId = project.id;

  if (!projectId || typeof projectId !== "string") {
    return null;
  }

  const repository = (project as { repository?: unknown }).repository;

  const taskId = (task as { id?: unknown }).id;

  if (!taskId || typeof taskId !== "string") {
    return null;
  }

  const lines: string[] = ["Setting up project environment..."];
  const flush = () => emit?.(lines.join("\n"));

  lines.push("Checking project folder...");
  const hasProjectFolder = createProjectFolder(projectId);
  if (!hasProjectFolder) {
    lines.push("✖ Failed to create project folder.");
    flush();
    return null;
  }
  lines.push(`✔ Project folder ready: ${getProjectFolder(projectId)}`);

  lines.push("Checking config folder...");
  const hasConfigFolder = createProjectConfigFolder(projectId);
  if (!hasConfigFolder) {
    lines.push("✖ Failed to create config folder.");
    flush();
    return null;
  }
  lines.push("✔ Config folder ready.");

  lines.push("Checking workdir...");
  const hasWorkDirFolder = createProjectWorkDirFolder(projectId);
  if (!hasWorkDirFolder) {
    lines.push("✖ Failed to create workdir folder.");
    flush();
    return null;
  }
  lines.push(`✔ Workdir ready: ${getProjectWorkDir(projectId)}`);

  if (repository && typeof repository === "string") {
    lines.push("Checking repository...");
    const cloned = cloneProjectRepo(projectId, repository);
    if (!cloned) {
      lines.push("✖ Failed to clone repository.");
      flush();
      return null;
    }
    lines.push("✔ Repository ready.");
  }

  lines.push("Checking Claude configuration...");
  createClaudeSettings(projectId);
  lines.push("✔ Claude configuration ready.");
  flush();

  await setupSkills({ project, emit });

  return {
    projectId,
    taskId,
    projectFolder: getProjectFolder(projectId),
    projectWorkDir: getProjectWorkDir(projectId),
  };
};
