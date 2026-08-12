import { AgentTag } from "@onezone/shared";
import type { TaskDetails } from "@onezone/shared";
import { setup as setupAcpx } from "../agents/acpx.js";
import { getEffectiveTaskAgentAndModel } from "../lib/effective-task-agent.js";

const AGENT_NAME_BY_TAG: Record<AgentTag, string> = {
  [AgentTag.ClaudeCode]: "claude",
  [AgentTag.GithubCopilotCLI]: "copilot",
  [AgentTag.Opencode]: "opencode",
};

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

  const agentName = AGENT_NAME_BY_TAG[agent.tag];
  if (!agentName) {
    return null;
  }

  return setupAcpx({ projectId, model, agentName });
};

export const setupTerminalAgent = (payload?: unknown) => {
  const task = (payload as { task?: unknown }).task as TaskDetails | undefined;

  if (!task || typeof task !== "object") {
    return null;
  }

  const project = (task as { project?: unknown }).project;

  if (!project || typeof project !== "object") {
    return null;
  }

  const projectId = (project as { id?: unknown }).id;
  const { agent: effectiveAgent, model: effectiveModel } =
    getEffectiveTaskAgentAndModel(task);

  if (!effectiveAgent || typeof effectiveAgent !== "object") {
    return null;
  }

  if (!effectiveModel || typeof effectiveModel !== "string") {
    return null;
  }

  const config = agentFactory({
    projectId: projectId as string,
    agent: effectiveAgent,
    model: effectiveModel,
  });

  if (!config) return null;

  return {
    config,
    agentId: (effectiveAgent as { id?: unknown }).id as string | undefined,
    agentName: (effectiveAgent as { name?: unknown }).name as string | undefined,
    model: effectiveModel,
  };
};

