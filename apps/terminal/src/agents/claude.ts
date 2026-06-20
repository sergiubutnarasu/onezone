import { AgentTag } from "@onezone/shared";
import { shellQuote } from "../lib/helper.js";
import {
  getClaudeSettingsPath,
  getProjectConfigFolder,
} from "../lib/project-paths.js";
import { AgentConfig } from "../lib/types/index.js";

export const setup = ({
  projectId,
  model,
}: {
  projectId: string;
  model: string;
}): AgentConfig => {
  const settingsPath = getClaudeSettingsPath(projectId);
  const configPath = getProjectConfigFolder(projectId);

  return {
    tag: AgentTag.ClaudeCode,
    cmd: `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --print --verbose --output-format stream-json --model ${shellQuote(model)} --add-dir "/${configPath}" --settings "/${settingsPath}" -p`,
  };
};
