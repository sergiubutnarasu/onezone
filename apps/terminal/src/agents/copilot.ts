import { AgentTag } from "@onezone/shared";
import { shellQuote } from "../lib/helper.js";
import {
  getCopilotInstructionsPath,
  getCopilotSettingsPath,
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
  const instructionsPath = getCopilotInstructionsPath(projectId);
  const settingsPath = getCopilotSettingsPath(projectId);
  const configPath = getProjectConfigFolder(projectId);

  return {
    tag: AgentTag.GithubCopilotCLI,
    cmd: `copilot --yolo -p --instructions "/${instructionsPath}" --settings "/${settingsPath}" --add-dir "/${configPath}" --model ${shellQuote(model)}`,
  };
};
