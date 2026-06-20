import { AgentTag } from "@onezone/shared";
import * as fs from "fs";
import * as path from "path";
import { shellQuote } from "../lib/helper.js";
import { getProjectConfigFolder } from "../lib/project-paths.js";
import { AgentConfig } from "../lib/types/index.js";

export const setup = ({
  projectId,
  model,
}: {
  projectId: string;
  model: string;
}): AgentConfig => {
  const configPath = getProjectConfigFolder(projectId);
  const githubDir = path.join(configPath, ".github");
  const githubSkillsDir = path.join(githubDir, "skills");
  const agentsSkillsDir = path.join(configPath, ".agents", "skills");

  // COPILOT_CUSTOM_INSTRUCTIONS_DIRS expects repository roots — the CLI looks for
  // `.github/instructions/NAME.instructions.md` (path-specific, requires `applyTo`
  // frontmatter) inside each listed directory. Repo-wide `.github/copilot-instructions.md`
  // is only loaded when the cwd is the repo root, so we rely on path-specific instructions
  // which load regardless of cwd.
  // https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions#creating-path-specific-custom-instructions
  const instructionsDirs = [configPath].filter((dir) =>
    fs.existsSync(path.join(dir, ".github", "instructions")),
  );

  // COPILOT_SKILLS_DIRS is a comma-separated list (not path.delimiter which is ":" on Unix).
  // https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#environment-variables
  const skillsDirs = [githubSkillsDir, agentsSkillsDir]
    .filter((dir) => fs.existsSync(dir))
    .join(",");

  return {
    tag: AgentTag.GithubCopilotCLI,
    cmd: `COPILOT_CUSTOM_INSTRUCTIONS_DIRS=${shellQuote(instructionsDirs.join(","))} COPILOT_SKILLS_DIRS=${shellQuote(skillsDirs)} copilot --allow-tool ${shellQuote("shell,write,read,skill")} --model ${shellQuote(model)} --output-format json -p`,
  };
};
