import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { ONEZONE_PROJECTS_LOCATION } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getProjectFolder = (projectId: string): string => {
  return path.join(os.homedir(), ONEZONE_PROJECTS_LOCATION, projectId);
};

export const getProjectConfigFolder = (projectId: string): string => {
  return path.join(
    os.homedir(),
    ONEZONE_PROJECTS_LOCATION,
    projectId,
    "config",
  );
};

export const getProjectWorkDir = (projectId: string): string => {
  return path.join(
    os.homedir(),
    ONEZONE_PROJECTS_LOCATION,
    projectId,
    "workdir",
  );
};

export const getClaudeSettingsPath = (projectId: string): string => {
  return path.join(
    os.homedir(),
    ONEZONE_PROJECTS_LOCATION,
    projectId,
    "config",
    ".claude",
    "settings.json",
  );
};

export const createProjectFolder = (projectId: string): boolean => {
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

export const createProjectWorkDirFolder = (projectId: string): boolean => {
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

export const createProjectConfigFolder = (projectId: string): boolean => {
  try {
    const configPath = getProjectConfigFolder(projectId);

    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }

    return true;
  } catch (err) {
    console.error(
      `Error creating project config folder: ${(err as Error).message}`,
    );
    return false;
  }
};

export const createClaudeSettings = (projectId: string): boolean => {
  try {
    const workDir = getProjectWorkDir(projectId);
    const projectConfigFolder = getProjectConfigFolder(projectId);
    const claudeDir = path.join(projectConfigFolder, ".claude");
    const settingsPath = path.join(claudeDir, "settings.json");

    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    const settings = {
      permissions: {
        allow: [`Bash(*)`, `Edit(/${workDir})`, `Read(/${workDir})`],
        deny: [`"Bash(!/${projectConfigFolder}/**)"`],
      },
      sandbox: {
        filesystem: {
          allowWrite: [`/${workDir}`],
          allowRead: [`/${workDir}`],
        },
      },
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // copy rules.md to the claude config folder
    const rulesSourcePath = path.join(
      __dirname,
      "..",
      "static",
      "claude",
      "rules.md",
    );
    const rulesDestPath = path.join(projectConfigFolder, "CLAUDE.local.md");

    if (fs.existsSync(rulesSourcePath)) {
      fs.copyFileSync(rulesSourcePath, rulesDestPath);
    } else {
      console.warn(`Warning: rules.md not found at ${rulesSourcePath}`);
    }

    return true;
  } catch (err) {
    console.error(`Error creating Claude settings: ${(err as Error).message}`);
    return false;
  }
};
