import {
  MessageStream,
  type ProjectInfo,
  type RunSkillCommandPayload,
  type TaskDetails,
} from "@onezone/shared";
import * as fs from "node:fs";
import * as path from "node:path";
import { runProcess, terminateTree } from "./process-runner.js";
import { getEffectiveTaskAgentCode } from "./effective-task-agent.js";
import {
  getAllInstalledSkills,
  getProjectWorkDir,
  removeSkill,
} from "./project-paths.js";
import { AGENT_TAG_MAPPINGS } from "./constants.js";

// Dedupes concurrent install attempts for the same skill across tasks/terminals.
const inFlightInstalls = new Map<string, Promise<void>>();

function getSkillDirs(
  workDir: string,
  agentCode: RunSkillCommandPayload["agentCode"],
  skillName: string,
): string[] {
  if (agentCode === "github-copilot-cli") {
    return [
      path.join(workDir, ".github", "skills", skillName),
      path.join(workDir, ".agents", "skills", skillName),
    ];
  }
  if (agentCode === "opencode") {
    return [
      path.join(workDir, ".opencode", "skills", skillName),
      path.join(workDir, ".agents", "skills", skillName),
    ];
  }
  return [path.join(workDir, ".claude", "skills", skillName)];
}

function skillExists(
  workDir: string,
  agentCode: RunSkillCommandPayload["agentCode"],
  skillName: string,
): boolean {
  return getSkillDirs(workDir, agentCode, skillName).some((dir) =>
    fs.existsSync(dir),
  );
}

export async function runSkillCommand(
  payload: RunSkillCommandPayload,
  log: (message: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { projectId, source, skillName, agentCode } = payload;
  const workDir = getProjectWorkDir(projectId);
  const skillDirs = getSkillDirs(workDir, agentCode, skillName);
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

  log(`[skill] Installing "${skillName}" in ${workDir}`);

  const installPromise = (async () => {
    try {
      const exitCode = await runAbortableShellCommand({
        cmd,
        cwd: workDir,
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
  const workDir = getProjectWorkDir(project.id);
  const agentCode = getEffectiveTaskAgentCode(task, project);

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
    (s) => !skillExists(workDir, agentCode, s.skillName),
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
