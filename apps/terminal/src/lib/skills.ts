import type { ProjectInfo, RunSkillCommandPayload } from "@onezone/shared";
import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import {
  getAllInstalledSkills,
  getProjectConfigFolder,
  removeSkill,
} from "./project-paths.js";

const execAsync = promisify(exec);

// Dedupes concurrent install attempts for the same skill across tasks/terminals.
const inFlightInstalls = new Map<string, Promise<void>>();

export async function runSkillCommand(
  payload: RunSkillCommandPayload,
  log: (message: string) => void,
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
    await pending;
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
      await execAsync(cmd, { cwd: configDir });
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
}: {
  project: ProjectInfo;
  emit?: (message: string) => void;
}) => {
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
      await runSkillCommand(
        {
          projectId: project.id,
          source: skill.source,
          skillName: skill.skillName,
        },
        (msg) => emit?.(msg),
      );
    }

    emit?.("✔ Skills ready.");
  }
};
