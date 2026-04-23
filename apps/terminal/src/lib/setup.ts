import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ONEZONE_PROJECTS_LOCATION } from "./constants.js";
import type { TaskJobConfig } from "./types.js";

export const getProjectFolder = (projectId: string): string => {
  return path.join(os.homedir(), ONEZONE_PROJECTS_LOCATION, projectId);
};

export const getProjectWorkDir = (projectId: string): string => {
  return path.join(
    os.homedir(),
    ONEZONE_PROJECTS_LOCATION,
    projectId,
    "workdir",
  );
};

const createProjectFolder = (projectId: string): boolean => {
  try {
    const projectPath = getProjectFolder(projectId);

    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    return true;
  } catch (err) {
    console.error(`Error creating project folder: ${(err as Error).message}`);
    return false;
  }
};

const createProjectWorkDirFolder = (projectId: string): boolean => {
  try {
    const projectPath = getProjectWorkDir(projectId);

    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    return true;
  } catch (err) {
    console.error(
      `Error creating project workdir folder: ${(err as Error).message}`,
    );
    return false;
  }
};

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

  const hasWorkDirFolder = createProjectWorkDirFolder(projectId);

  if (!hasWorkDirFolder) {
    return null;
  }

  return {
    projectId,
    taskId,
    projectFolder: getProjectFolder(projectId),
    projectWorkDir: getProjectWorkDir(projectId),
  };
};
