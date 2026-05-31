import {
  MessageStream,
  type ProjectInfo,
  type RunSkillCommandPayload,
} from "@onezone/shared";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getAllInstalledSkills,
  getProjectConfigFolder,
  removeSkill,
} from "./project-paths.js";
import { runProcess, terminateTree } from "./process-runner.js";

// Dedupes concurrent install attempts for the same skill across tasks/terminals.
const inFlightInstalls = new Map<string, Promise<void>>();

export async function runSkillCommand(
  payload: RunSkillCommandPayload,
  log: (message: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { projectId, source, skillName } = payload;
  const configDir = getProjectConfigFolder(projectId);
  const skillDir = path.join(configDir, ".claude", "skills", skillName);
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
  if (fs.existsSync(skillDir)) {
    return;
  }

  const cmd = `npx --yes skills add ${JSON.stringify(source)} --skill ${JSON.stringify(skillName)} -a claude-code -y --copy`;

  log(`[skill] Installing "${skillName}" in ${configDir}`);

  const installPromise = (async () => {
    try {
      const exitCode = await runAbortableShellCommand({
        cmd,
        cwd: configDir,
        signal,
        onLine: (stream, line) => {
          const prefix = stream === MessageStream.Stderr ? "stderr" : "stdout";
          log(`[skill] ${prefix}: ${line}`);
        },
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
  project,
  emit,
  signal,
}: {
  project: ProjectInfo;
  emit?: (message: string) => void;
  signal?: AbortSignal;
}) => {
  if (signal?.aborted) return;

  const skills = project?.skills ?? [];
  const configDir = getProjectConfigFolder(project.id);

  // remove extra skills
  const installedSkills = getAllInstalledSkills(project.id);
  for (const skill of installedSkills) {
    if (
      !skill.startsWith("onezone") &&
      !skills.find((s) => s.skillName === skill)
    ) {
      // remove skill directory
      removeSkill(project.id, skill);
    }
  }

  const uninstalledSkills = skills.filter((s) => {
    const skillDir = path.join(configDir, ".claude", "skills", s.skillName);
    return !fs.existsSync(skillDir);
  });

  if (uninstalledSkills.length > 0) {
    emit?.(`Installing ${uninstalledSkills.length} skill(s)...`);
    for (const skill of uninstalledSkills) {
      if (signal?.aborted) return;
      await runSkillCommand(
        {
          projectId: project.id,
          source: skill.source,
          skillName: skill.skillName,
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
  onLine: (stream: MessageStream, line: string) => void;
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
