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

  const project = (task as { project?: unknown }).project;

  if (!project || typeof project !== "object") {
    return null;
  }

  const projectId = (project as { id?: unknown }).id;
  const useTaskAgentAndModel = (task as { useTaskAgentAndModel?: unknown }).useTaskAgentAndModel ?? false;

  // Determine effective agent and model:
  // If useTaskAgentAndModel is false and the column has an agent configured, use the column's agent/model.
  // Otherwise fall back to the task's own agent/model.
  const column = (task as { column?: unknown }).column as TaskDetails["column"];

  let effectiveAgent: TaskDetails["agent"];
  let effectiveModel: string | undefined;

  if (!useTaskAgentAndModel && column?.agentId && column?.agent) {
    effectiveAgent = column.agent;
    effectiveModel = column.model ?? (task as { model?: unknown }).model as string | undefined;
  } else {
    effectiveAgent = (task as { agent?: unknown }).agent as TaskDetails["agent"];
    effectiveModel = (task as { model?: unknown }).model as string | undefined;
  }

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

