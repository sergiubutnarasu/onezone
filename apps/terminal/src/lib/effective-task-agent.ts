import type { ProjectInfo, TaskDetails } from "@onezone/shared";

export function getEffectiveTaskAgentAndModel(
  task: TaskDetails | undefined,
  project?: ProjectInfo,
) {
  if (task && !task.useTaskAgentAndModel && task.column?.agent?.tag) {
    return {
      agent: task.column.agent,
      model: task.column.model ?? task.model ?? project?.defaultModel ?? null,
    };
  }

  if (task?.agent?.tag) {
    return {
      agent: task.agent,
      model: task.model ?? project?.defaultModel ?? null,
    };
  }

  return {
    agent: project?.defaultAgent ?? null,
    model: project?.defaultModel ?? null,
  };
}

export function getEffectiveTaskAgentCode(
  task: TaskDetails | undefined,
  project: ProjectInfo,
) {
  return getEffectiveTaskAgentAndModel(task, project).agent?.tag ?? null;
}