import { execFile, execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { ONEZONE_PROJECTS_LOCATION } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

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
  signal?: AbortSignal,
): Promise<boolean> => {
  try {
    const workDir = getProjectWorkDir(projectId);
    const gitDir = path.join(workDir, ".git");

    if (fs.existsSync(gitDir)) {
      return Promise.resolve(true);
    }

    if (signal?.aborted) {
      return Promise.resolve(false);
    }

    const repoUrl = repository.startsWith("https://")
      ? repository.replace(
          /^https:\/\/([^/]+)\/(.+?)(?:\.git)?$/,
          "git@$1:$2.git",
        )
      : repository;

    return execFileAsync(
      "git",
      ["clone", "--single-branch", "--depth", "1", repoUrl, workDir],
      { signal },
    )
      .then(() => true)
      .catch((err) => {
        if ((err as { name?: string }).name !== "AbortError") {
          console.error(`Error cloning repository: ${(err as Error).message}`);
        }
        return false;
      });
  } catch (err) {
    console.error(`Error cloning repository: ${(err as Error).message}`);
    return Promise.resolve(false);
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
        allow: [
          `Bash(*)`,
          `Edit(/${workDir})`,
          `Read(/${workDir})`,
          `Read(/${projectConfigFolder})`,
        ],
      },
      sandbox: {
        filesystem: {
          allowWrite: [`/${workDir}`],
          allowRead: [`/${workDir}`, `/${projectConfigFolder}`],
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

export const createCopilotSettings = (projectId: string): boolean => {
  try {
    const workDir = getProjectWorkDir(projectId);
    const projectConfigFolder = getProjectConfigFolder(projectId);
    const githubDir = path.join(projectConfigFolder, ".github");
    const copilotDir = path.join(githubDir, "copilot");
    const instructionsDir = path.join(githubDir, "instructions");
    const instructionsPath = path.join(
      instructionsDir,
      "onezone.instructions.md",
    );
    const settingsPath = path.join(copilotDir, "settings.json");

    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }
    if (!fs.existsSync(copilotDir)) {
      fs.mkdirSync(copilotDir, { recursive: true });
    }
    if (!fs.existsSync(instructionsDir)) {
      fs.mkdirSync(instructionsDir, { recursive: true });
    }

    const settings = {
      permissions: {
        allow: [
          `Bash(*)`,
          `Edit(/${workDir})`,
          `Read(/${workDir})`,
          `Read(/${projectConfigFolder})`,
        ],
      },
      sandbox: {
        filesystem: {
          allowWrite: [`/${workDir}`],
          allowRead: [`/${workDir}`, `/${projectConfigFolder}`],
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

    // copy rules.md to the copilot instructions file
    const rulesSourcePath = path.join(
      __dirname,
      "..",
      "static",
      "agent",
      "rules.md",
    );

    if (fs.existsSync(rulesSourcePath)) {
      const rules = fs.readFileSync(rulesSourcePath, "utf8");
      fs.writeFileSync(instructionsPath, `---\napplyTo: "**"\n---\n\n${rules}`);
    } else {
      console.warn(`Warning: rules.md not found at ${rulesSourcePath}`);
    }

    // copy skills folder to the copilot skills directories
    const skillsSourcePath = path.join(
      __dirname,
      "..",
      "static",
      "agent",
      "skills",
    );
    const githubSkillsDestPath = path.join(githubDir, "skills");
    const agentsSkillsDestPath = path.join(
      projectConfigFolder,
      ".agents",
      "skills",
    );

    if (fs.existsSync(skillsSourcePath)) {
      const skillDirs = fs.readdirSync(skillsSourcePath);
      for (const skillDir of skillDirs) {
        fs.cpSync(
          path.join(skillsSourcePath, skillDir),
          path.join(githubSkillsDestPath, skillDir),
          { recursive: true },
        );
        fs.cpSync(
          path.join(skillsSourcePath, skillDir),
          path.join(agentsSkillsDestPath, skillDir),
          { recursive: true },
        );
      }
    } else {
      console.warn(`Warning: skills folder not found at ${skillsSourcePath}`);
    }

    return true;
  } catch (err) {
    console.error(
      `Error creating Copilot settings: ${(err as Error).message}`,
    );
    return false;
  }
};

const getSkillsDirs = (projectId: string, agentTag?: string): string[] => {
  const configDir = getProjectConfigFolder(projectId);
  if (agentTag === "github-copilot-cli") {
    return [
      path.join(configDir, ".github", "skills"),
      path.join(configDir, ".agents", "skills"),
    ];
  }
  return [path.join(configDir, ".claude", "skills")];
};

export const getAllInstalledSkills = (
  projectId: string,
  agentTag?: string,
): string[] => {
  try {
    const skillsDirs = getSkillsDirs(projectId, agentTag);
    const skills = new Set<string>();

    for (const skillsDir of skillsDirs) {
      if (!fs.existsSync(skillsDir)) {
        continue;
      }

      const skillFiles = fs.readdirSync(skillsDir);
      for (const file of skillFiles) {
        skills.add(path.parse(file).name);
      }
    }

    return Array.from(skills);
  } catch (err) {
    console.error(`Error getting installed skills: ${(err as Error).message}`);
    return [];
  }
};

export const removeSkill = (
  projectId: string,
  skillName: string,
  agentTag?: string,
): boolean => {
  try {
    const skillsDirs = getSkillsDirs(projectId, agentTag);
    let removed = false;

    for (const skillsDir of skillsDirs) {
      const skillPath = path.join(skillsDir, skillName);

      if (fs.existsSync(skillPath)) {
        fs.rmSync(skillPath, { recursive: true, force: true });
        removed = true;
      }
    }

    if (!removed) {
      console.warn(
        `Warning: skill "${skillName}" not found in any skills directory`,
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Error removing skill: ${(err as Error).message}`);
    return false;
  }
};
