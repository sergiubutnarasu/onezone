import type { ProjectInfo, RunSkillCommandPayload } from "@onezone/shared";
import { execSync } from "node:child_process";
import {
  getAllInstalledSkills,
  getProjectConfigFolder,
  removeSkill,
} from "./project-paths.js";

export function runSkillCommand(
  payload: RunSkillCommandPayload,
  log: (message: string) => void,
): void {
  const { projectId, source, skillName } = payload;
  const configDir = getProjectConfigFolder(projectId);

  const cmd = `npx --yes skills add ${source} --skill ${JSON.stringify(skillName)} -a claude-code -y --copy`;

  log(`[skill] Installing "${skillName}" in ${configDir}`);

  try {
    execSync(cmd, { cwd: configDir, stdio: "pipe" });
    log(`[skill] Installing "${skillName}" completed`);
  } catch (err) {
    const e = err as { message?: string; stderr?: Buffer; stdout?: Buffer };
    const detail =
      e.stderr?.toString().trim() || e.stdout?.toString().trim() || e.message;
    log(`[skill] Installing "${skillName}" failed: ${detail}`);
  }
}

export const setupSkills = ({
  project,
  emit,
}: {
  project: ProjectInfo;
  emit?: (message: string) => void;
}) => {
  const skills = project?.skills ?? [];

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

  const uninstalledSkills = skills.filter(
    (s) => !installedSkills.includes(s.skillName),
  );

  if (uninstalledSkills.length > 0) {
    emit?.(`Installing ${uninstalledSkills.length} skill(s)...`);
    for (const skill of uninstalledSkills) {
      runSkillCommand(
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
