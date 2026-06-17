import { AgentTag } from "@onezone/shared";
import { createClaudeParser } from "./claude.js";
import { createCopilotParser } from "./copilot.js";
import { type AgentOutputParser } from "./types.js";

export * from "./types.js";
export { createClaudeParser, parseClaudeStreamJsonLine } from "./claude.js";
export { createCopilotParser } from "./copilot.js";

export function createAgentOutputParser(tag: AgentTag): AgentOutputParser {
  switch (tag) {
    case AgentTag.ClaudeCode:
      return createClaudeParser();
    case AgentTag.GithubCopilotCLI:
      return createCopilotParser();
    default:
      return () => undefined;
  }
}
