// Parses a single line of an agent's stdout output and extracts displayable
// content blocks.  All agents now emit the same unified JSON-array format
// (UnifiedContentBlock[]), so this file no longer branches on agent type.

import type { UnifiedContentBlock } from "@onezone/shared";

export type ContentBlock = UnifiedContentBlock;
export type AgentContentParser = (raw: string) => ContentBlock[] | null;

// ---------------------------------------------------------------------------
// Unified parser (agent-agnostic)
// ---------------------------------------------------------------------------

export function parseAgentLine(raw: string): ContentBlock[] | null {
  const blocks = parseJsonLine(raw);
  if (!blocks) return [{ kind: "raw", text: raw }];

  if (!Array.isArray(blocks)) return null;

  const result: ContentBlock[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    const b = block as Record<string, unknown>;
    const kind = b.kind;

    if (kind === "text" && typeof b.text === "string" && b.text.trim()) {
      result.push({ kind: "text", text: b.text });
    } else if (kind === "thinking" && typeof b.text === "string" && b.text.trim()) {
      result.push({ kind: "thinking", text: b.text });
    } else if (kind === "tool_use" && typeof b.name === "string") {
      result.push({ kind: "tool_use", name: b.name, input: (b.input as Record<string, unknown>) ?? {} });
    } else if (kind === "tool_result" && typeof b.text === "string" && b.text.trim()) {
      result.push({ kind: "tool_result", text: b.text });
    } else if (kind === "raw" && typeof b.text === "string" && b.text.trim()) {
      result.push({ kind: "raw", text: b.text });
    }
  }

  return result.length > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonLine(raw: string): unknown[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
