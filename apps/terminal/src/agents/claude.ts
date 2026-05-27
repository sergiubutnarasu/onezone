import { AgentTag } from "@onezone/shared";
import { shellQuote } from "../lib/helper.js";
import {
  getClaudeSettingsPath,
  getProjectConfigFolder,
} from "../lib/project-paths.js";
import { AgentConfig } from "../lib/types.js";

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
    cmd: `ANTHROPIC_AUTH_TOKEN=f584d58a91394ab69872d2875eff6562.U9Na7jVAKZ3As1fipjW3f0g2 ANTHROPIC_BASE_URL=https://ollama.com ANTHROPIC_API_KEY=""CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --print --verbose --output-format stream-json --model ${shellQuote(model)} --add-dir "/${configPath}" --settings "/${settingsPath}" -p`,
  };
};
