import { AgentTag } from "@onezone/shared";
import { shellQuote } from "../lib/helper.js";
import { AgentConfig } from "../lib/types.js";

export const setup = ({ model }: { model: string }): AgentConfig => {
  return {
    tag: AgentTag.CopilotCLI,
    cmd: `COPILOT_PROVIDER_BASE_URL=http://localhost:11434/v1 COPILOT_PROVIDER_API_KEY= COPILOT_PROVIDER_WIRE_API=responses COPILOT_MODEL=${shellQuote(model)} copilot --yolo -p`,
  };
};
