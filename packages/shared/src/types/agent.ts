import type { AgentTag } from "./enums.js";

export interface Agent {
  id: string;
  name: string;
  tag: AgentTag;
  model: string;
  defaultModel?: string;
  userModel?: string | null;
  createdAt: string;
}
