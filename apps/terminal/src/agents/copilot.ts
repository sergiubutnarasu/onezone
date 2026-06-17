import { AgentTag } from "@onezone/shared";
import * as fs from "fs";
import * as path from "path";
import { shellQuote } from "../lib/helper.js";
import { getProjectConfigFolder } from "../lib/project-paths.js";
import { AgentConfig } from "../lib/types.js";

export const setup = ({
  projectId,
  model,
}: {
  projectId: string;
  model: string;
}): AgentConfig => {
  const configPath = getProjectConfigFolder(projectId);
  const instructionsDir = path.join(configPath, ".github");
  const githubSkillsDir = path.join(instructionsDir, "skills");
  const agentsSkillsDir = path.join(configPath, ".agents", "skills");

  const skillsDirs = [githubSkillsDir, agentsSkillsDir]
    .filter((dir) => fs.existsSync(dir))
    .join(path.delimiter);

  // https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#environment-variables

  return {
    tag: AgentTag.GithubCopilotCLI,
    cmd: `COPILOT_CUSTOM_INSTRUCTIONS_DIRS=${shellQuote(instructionsDir)} COPILOT_SKILLS_DIRS=${shellQuote(skillsDirs)} copilot --allow-tool ${shellQuote("shell,write,read")} --model ${shellQuote(model)} --output-format json -p`,
  };
};
