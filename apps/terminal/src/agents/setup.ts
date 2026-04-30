import { AgentTag, TaskDetails } from "@onezone/shared";
import { setup as setupClaude } from "../agents/claude.js";
import { setup as setupCopilot } from "../agents/copilot.js";

export const agentFactory = ({
  agent,
  model,
}: {
  agent: TaskDetails["agent"];
  model: string;
}) => {
  if (!agent) {
    return null;
  }

  switch (agent.tag) {
    case AgentTag.ClaudeCode:
      return setupClaude({ model });
    case AgentTag.CopilotCLI:
      return setupCopilot({ model });
    default:
      return null;
  }
};

export const setupTerminalAgent = (payload?: unknown) => {
  const task = (payload as { task?: unknown }).task;

  if (!task || typeof task !== "object") {
    return null;
  }

  const agent = (task as { agent?: unknown }).agent;

  if (!agent || typeof agent !== "object") {
    return null;
  }

  const model = (task as { model?: unknown }).model;

  if (!model || typeof model !== "string") {
    return null;
  }

  return agentFactory({
    agent: agent as TaskDetails["agent"],
    model,
  });
};
