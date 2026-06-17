import {
  AgentTag,
  MessageStream,
  type ProjectInfo,
  type RunSkillCommandPayload,
  type TaskDetails,
} from "@onezone/shared";
import * as fs from "node:fs";
import * as path from "node:path";
import { runProcess, terminateTree } from "./process-runner.js";
import {
  getAllInstalledSkills,
  getProjectConfigFolder,
  removeSkill,
} from "./project-paths.js";

// Dedupes concurrent install attempts for the same skill across tasks/terminals.
const inFlightInstalls = new Map<string, Promise<void>>();

const AGENT_TAG_MAPPINGS: Record<AgentTag, string> = {
  [AgentTag.GithubCopilotCLI]: "github-copilot",
  [AgentTag.ClaudeCode]: "claude-code",
}

function getSkillDirs(
  configDir: string,
  agentCode: RunSkillCommandPayload["agentCode"],
  skillName: string,
): string[] {
  if (agentCode === "github-copilot-cli") {
    return [
      path.join(configDir, ".github", "skills", skillName),
      path.join(configDir, ".agents", "skills", skillName),
    ];
  }
  return [path.join(configDir, ".claude", "skills", skillName)];
}

function skillExists(
  configDir: string,
  agentCode: RunSkillCommandPayload["agentCode"],
  skillName: string,
): boolean {
  return getSkillDirs(configDir, agentCode, skillName).some((dir) =>
    fs.existsSync(dir),
  );
}

export async function runSkillCommand(
  payload: RunSkillCommandPayload,
  log: (message: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { projectId, source, skillName, agentCode } = payload;
  const configDir = getProjectConfigFolder(projectId);
  const skillDirs = getSkillDirs(configDir, agentCode, skillName);
  const key = `${projectId}:${skillName}`;

  // If another setup is already installing this skill, wait for it instead
  // of launching a second `npx skills add`.
  const pending = inFlightInstalls.get(key);
  if (pending) {
    log(`[skill] Awaiting in-progress install for "${skillName}"`);
    await waitForInstall(pending, signal);
    return;
  }

  if (signal?.aborted) {
    return;
  }

  // Re-check existence just before installing in case a previous call
  // completed between the caller's check and this point.
  if (skillDirs.some((dir) => fs.existsSync(dir))) {
    return;
  }

  const cmd = `npx --yes skills add ${JSON.stringify(source)} --skill ${JSON.stringify(skillName)} -a ${JSON.stringify(AGENT_TAG_MAPPINGS[agentCode])} -y --copy`;

  log(`[skill] Installing "${skillName}" in ${configDir}`);

  const installPromise = (async () => {
    try {
      const exitCode = await runAbortableShellCommand({
        cmd,
        cwd: configDir,
        signal,
      });
      if (exitCode !== 0) {
        log(`[skill] Installing "${skillName}" exited with code ${exitCode}`);
        return;
      }
      log(`[skill] Installing "${skillName}" completed`);
    } catch (err) {
      const e = err as { message?: string; stderr?: string; stdout?: string };
      const detail = e.stderr?.trim() || e.stdout?.trim() || e.message;
      log(`[skill] Installing "${skillName}" failed: ${detail}`);
    }
  })();

  inFlightInstalls.set(key, installPromise);
  try {
    await installPromise;
  } finally {
    inFlightInstalls.delete(key);
  }
}

export const setupSkills = async ({
  task,
  project,
  emit,
  signal,
}: {
  task?: TaskDetails;
  project: ProjectInfo;
  emit?: (message: string) => void;
  signal?: AbortSignal;
}) => {
  if (signal?.aborted) return;

  const skills = project?.skills ?? [];
  const configDir = getProjectConfigFolder(project.id);
  const agentCode = getSkillInstallAgentCode(task, project);

  if (!agentCode) {
    emit?.("Skipping skill install: no agent configured.");
    return;
  }

  // remove extra skills
  const installedSkills = getAllInstalledSkills(project.id, agentCode);
  for (const skill of installedSkills) {
    if (
      !skill.startsWith("onezone") &&
      !skills.find((s) => s.skillName === skill)
    ) {
      // remove skill directory
      removeSkill(project.id, skill, agentCode);
    }
  }

  const uninstalledSkills = skills.filter(
    (s) => !skillExists(configDir, agentCode, s.skillName),
  );

  if (uninstalledSkills.length > 0) {
    emit?.(`Installing ${uninstalledSkills.length} skill(s)...`);
    for (const skill of uninstalledSkills) {
      if (signal?.aborted) return;
      await runSkillCommand(
        {
          projectId: project.id,
          source: skill.source,
          skillName: skill.skillName,
          agentCode,
        },
        (msg) => emit?.(msg),
        signal,
      );
    }

    if (signal?.aborted) return;
    emit?.("✔ Skills ready.");
  }
};

function getSkillInstallAgentCode(
  task: TaskDetails | undefined,
  project: ProjectInfo,
): RunSkillCommandPayload["agentCode"] | null {
  if (task && !task.useTaskAgentAndModel && task.column?.agent?.tag) {
    return task.column.agent.tag;
  }

  if (task?.agent?.tag) {
    return task.agent.tag;
  }

  return project.defaultAgent?.tag ?? null;
}

function waitForInstall(
  pending: Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  if (!signal) return pending;
  if (signal.aborted) return Promise.resolve();

  return Promise.race([
    pending,
    new Promise<void>((resolve) => {
      signal.addEventListener("abort", () => resolve(), { once: true });
    }),
  ]);
}

function runAbortableShellCommand({
  cmd,
  cwd,
  signal,
  onLine,
}: {
  cmd: string;
  cwd: string;
  signal?: AbortSignal;
  onLine?: (stream: MessageStream, line: string) => void;
}): Promise<number> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(130);
      return;
    }

    const proc = runProcess({
      cmd,
      args: [],
      cwd,
      shell: true,
      onLine,
      onExit: resolve,
    });

    const abort = () => {
      if (proc.pid) terminateTree(proc.pid);
    };

    signal?.addEventListener("abort", abort, { once: true });
    proc.once("close", () => signal?.removeEventListener("abort", abort));
    proc.once("error", () => signal?.removeEventListener("abort", abort));
  });
}
