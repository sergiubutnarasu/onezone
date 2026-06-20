// apps/server/src/libs/agent-tag.ts

import { AgentTag } from "@onezone/shared";

/** Safely cast a Prisma string enum to AgentTag. */
export function toAgentTag(tag: string): AgentTag {
  return tag as unknown as AgentTag;
}
