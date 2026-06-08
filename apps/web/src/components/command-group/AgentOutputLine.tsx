"use client";

import { parseAgentLine } from "@/lib/agent-content";
import { ContentBlockView } from "./ContentBlockView";
import type { AgentOutputLineProps } from "./types";

export function AgentOutputLine({
  content,
  expandSignal,
  expandDirection,
}: AgentOutputLineProps) {
  const blocks = parseAgentLine(content);

  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <>
      {blocks.map((block, i) => (
        <ContentBlockView
          key={i}
          block={block}
          expandSignal={expandSignal}
          expandDirection={expandDirection}
        />
      ))}
    </>
  );
}
