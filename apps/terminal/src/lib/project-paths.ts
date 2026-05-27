import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { ONEZONE_PROJECTS_LOCATION } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isRtkAvailable = (): boolean => {
  try {
    execSync("rtk --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

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

export const getProjectMemoriesFolder = (projectId: string): string => {
  return path.join(
    os.homedir(),
    ONEZONE_PROJECTS_LOCATION,
    projectId,
    "config",
    "memories",
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

export const cloneProjectRepo = (
  projectId: string,
  repository: string,
): boolean => {
  try {
    const workDir = getProjectWorkDir(projectId);
    const gitDir = path.join(workDir, ".git");

    if (fs.existsSync(gitDir)) {
      return true;
    }

    const repoUrl = repository.startsWith("https://")
      ? repository.replace(
          /^https:\/\/([^/]+)\/(.+?)(?:\.git)?$/,
          "git@$1:$2.git",
        )
      : repository;

    execSync(
      `git clone ${JSON.stringify(repoUrl)} ${JSON.stringify(workDir)}`,
      {
        stdio: "pipe",
      },
    );

    return true;
  } catch (err) {
    console.error(`Error cloning repository: ${(err as Error).message}`);
    return false;
  }
};

export const createClaudeSettings = (projectId: string): boolean => {
  try {
    const workDir = getProjectWorkDir(projectId);
    const projectConfigFolder = getProjectConfigFolder(projectId);
    const memoriesFolder = getProjectMemoriesFolder(projectId);
    const claudeDir = path.join(projectConfigFolder, ".claude");
    const settingsPath = path.join(claudeDir, "settings.json");

    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    const settings = {
      permissions: {
        allow: [
          `Bash(*)`,
          `Edit(/${workDir})`,
          `Read(/${workDir})`,
          `Edit(/${memoriesFolder})`,
          `Read(/${memoriesFolder})`,
        ],
      },
      sandbox: {
        filesystem: {
          allowWrite: [`/${workDir}`, `/${memoriesFolder}`],
          allowRead: [`/${workDir}`, `/${memoriesFolder}`],
        },
      },
      ...(isRtkAvailable() && {
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "rtk hook claude" }],
            },
          ],
        },
      }),
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // copy rules.md to the claude config folder
    const rulesSourcePath = path.join(
      __dirname,
      "..",
      "static",
      "agent",
      "rules.md",
    );
    const rulesDestPath = path.join(projectConfigFolder, "CLAUDE.local.md");

    if (fs.existsSync(rulesSourcePath)) {
      fs.copyFileSync(rulesSourcePath, rulesDestPath);
    } else {
      console.warn(`Warning: rules.md not found at ${rulesSourcePath}`);
    }

    // copy skills folder to the claude config folder
    const skillsSourcePath = path.join(
      __dirname,
      "..",
      "static",
      "agent",
      "skills",
    );
    const skillsDestPath = path.join(claudeDir, "skills");

    if (fs.existsSync(skillsSourcePath)) {
      const skillDirs = fs.readdirSync(skillsSourcePath);
      for (const skillDir of skillDirs) {
        fs.cpSync(
          path.join(skillsSourcePath, skillDir),
          path.join(skillsDestPath, skillDir),
          { recursive: true },
        );
      }
    } else {
      console.warn(`Warning: skills folder not found at ${skillsSourcePath}`);
    }

    return true;
  } catch (err) {
    console.error(`Error creating Claude settings: ${(err as Error).message}`);
    return false;
  }
};

export const getAllInstalledSkills = (projectId: string): string[] => {
  try {
    const configDir = getProjectConfigFolder(projectId);
    const skillsDir = path.join(configDir, ".claude", "skills");

    if (!fs.existsSync(skillsDir)) {
      return [];
    }

    const skillFiles = fs.readdirSync(skillsDir);
    return skillFiles.map((file) => path.parse(file).name);
  } catch (err) {
    console.error(`Error getting installed skills: ${(err as Error).message}`);
    return [];
  }
};

export const removeSkill = (projectId: string, skillName: string): boolean => {
  try {
    const configDir = getProjectConfigFolder(projectId);
    const skillPath = path.join(configDir, ".claude", "skills", `${skillName}`);

    if (fs.existsSync(skillPath)) {
      fs.rmSync(skillPath, { recursive: true, force: true });
      return true;
    } else {
      console.warn(`Warning: skill "${skillName}" not found at ${skillPath}`);
      return false;
    }
  } catch (err) {
    console.error(`Error removing skill: ${(err as Error).message}`);
    return false;
  }
};
