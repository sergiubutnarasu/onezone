import { AgentTag } from "@onezone/shared";
import type { TaskDetails } from "@onezone/shared";
import { setup as setupClaude } from "../agents/claude.js";
import { setup as setupCopilot } from "../agents/copilot.js";

export const agentFactory = ({
  projectId,
  agent,
  model,
}: {
  projectId: string;
  agent: TaskDetails["agent"];
  model: string;
}) => {
  if (!agent) {
    return null;
  }

  switch (agent.tag) {
    case AgentTag.ClaudeCode:
      return setupClaude({ projectId, model });
    case AgentTag.CopilotCLI:
      return setupCopilot({ model });
    default:
      return null;
  }
};

export const setupTerminalAgent = (payload?: unknown) => {
  const task = (payload as { task?: unknown }).task as TaskDetails | undefined;

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

  const project = (task as { project?: unknown }).project;

  if (!project || typeof project !== "object") {
    return null;
  }

  const projectId = (project as { id?: unknown }).id;

  return agentFactory({
    projectId: projectId as string,
    agent: agent as TaskDetails["agent"],
    model,
  });
};
