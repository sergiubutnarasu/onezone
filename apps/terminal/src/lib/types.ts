import { AgentTag } from "@onezone/shared";

export type TaskJobConfig = {
  projectId: string;
  taskId: string;
  projectFolder: string;
  projectWorkDir: string;
};

export type AgentConfig = {
  tag: AgentTag;
  cmd: string;
};
