// Unified content-block format emitted by all agent runners.
// The web frontend parses this shape without knowing which agent produced it.

export type UnifiedContentBlock =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool_use"; name: string; input: Record<string, unknown> }
  | { kind: "tool_result"; text: string }
  | { kind: "raw"; text: string };
