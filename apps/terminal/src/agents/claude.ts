import { AgentTag } from "@onezone/shared";
import { shellQuote } from "../lib/helper.js";
import { AgentConfig } from "../lib/types.js";

export const setup = ({ model }: { model: string }): AgentConfig => {
  return {
    tag: AgentTag.ClaudeCode,
    cmd: `ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://localhost:11434 ANTHROPIC_API_KEY="" claude --model ${shellQuote(model)} --dangerously-skip-permissions -p`,
  };
};
