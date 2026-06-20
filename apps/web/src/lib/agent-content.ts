// Parses a single line of an agent's --output-format stream-json output
// and extracts displayable content blocks.

import { AgentTag } from "@onezone/shared";

export type ContentBlock =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool_use"; name: string; input: Record<string, unknown> }
  | { kind: "tool_result"; text: string }
  | { kind: "raw"; text: string };

export type AgentContentParser = (raw: string) => ContentBlock[] | null;

// ---------------------------------------------------------------------------
// Claude Code parser
// ---------------------------------------------------------------------------

function parseClaudeLine(obj: Record<string, unknown>): ContentBlock[] | null {
  // Skip system/init messages entirely
  if (obj.type === "system") return null;

  // Assistant messages — extract content blocks
  if (obj.type === "assistant") {
    const message = obj.message as Record<string, unknown> | undefined;
    const contentBlocks = message?.content as unknown[] | undefined;
    if (!Array.isArray(contentBlocks)) return null;

    const result: ContentBlock[] = [];
    for (const block of contentBlocks) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;

      if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
        result.push({ kind: "text", text: b.text });
      } else if (b.type === "thinking" && typeof b.thinking === "string" && b.thinking.trim()) {
        result.push({ kind: "thinking", text: b.thinking });
      } else if (b.type === "tool_use" && typeof b.name === "string") {
        result.push({ kind: "tool_use", name: b.name, input: (b.input as Record<string, unknown>) ?? {} });
      }
    }
    return result.length > 0 ? result : null;
  }

  // User messages — extract tool results
  if (obj.type === "user") {
    const message = obj.message as Record<string, unknown> | undefined;
    const contentBlocks = message?.content as unknown[] | undefined;
    if (!Array.isArray(contentBlocks)) return null;

    const result: ContentBlock[] = [];
    for (const block of contentBlocks) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;

      if (b.type === "tool_result") {
        const text = extractToolResultText(b.content);
        if (text) result.push({ kind: "tool_result", text });
      }
    }
    return result.length > 0 ? result : null;
  }

  // Final result message — Claude uses top-level `result` string
  if (obj.type === "result") {
    const resultText = typeof obj.result === "string" ? obj.result : null;
    if (resultText && resultText.trim()) {
      return [{ kind: "text", text: resultText }];
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Copilot CLI parser
// ---------------------------------------------------------------------------

function parseCopilotLine(obj: Record<string, unknown>): ContentBlock[] | null {
  // Assistant message with text content and tool requests
  if (obj.type === "assistant.message") {
    const data = obj.data as Record<string, unknown> | undefined;
    const result: ContentBlock[] = [];

    const content = typeof data?.content === "string" ? data.content : null;
    if (content && content.trim()) {
      result.push({ kind: "text", text: content });
    }

    const toolRequests = Array.isArray(data?.toolRequests)
      ? (data.toolRequests as Record<string, unknown>[])
      : [];
    for (const req of toolRequests) {
      if (!req || typeof req !== "object") continue;
      const name = typeof req.name === "string" ? req.name : "tool";
      const input = (req.arguments as Record<string, unknown> | undefined) ?? {};
      result.push({ kind: "tool_use", name, input });
    }
    return result.length > 0 ? result : null;
  }

  // Tool execution result
  if (
    obj.type === "tool.execution_complete" ||
    obj.type === "tool.execution_partial_result"
  ) {
    const data = obj.data as Record<string, unknown> | undefined;
    const result = data?.result as Record<string, unknown> | undefined;
    const resultContent = typeof result?.content === "string" ? result.content : null;
    const partialOutput = typeof data?.partialOutput === "string" ? data.partialOutput : null;
    const text = resultContent ?? partialOutput;
    if (text && text.trim()) {
      return [{ kind: "tool_result", text }];
    }
    return null;
  }

  if (obj.type === "result") {
    const data = obj.data as Record<string, unknown> | undefined;
    const resultText = typeof data?.result === "string" ? data.result : null;
    if (resultText && resultText.trim()) {
      return [{ kind: "text", text: resultText }];
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAgentContentParser(tag: AgentTag): AgentContentParser {
  switch (tag) {
    case AgentTag.ClaudeCode:
      return parseClaudeAgentLine;
    case AgentTag.GithubCopilotCLI:
      return parseCopilotAgentLine;
    default:
      return parseAgentLine;
  }
}

// ---------------------------------------------------------------------------
// Parsers (raw string → ContentBlock[])
// ---------------------------------------------------------------------------

function parseClaudeAgentLine(raw: string): ContentBlock[] | null {
  const obj = parseJsonLine(raw);
  if (!obj) return [{ kind: "text", text: raw }];
  return parseClaudeLine(obj);
}

function parseCopilotAgentLine(raw: string): ContentBlock[] | null {
  const obj = parseJsonLine(raw);
  if (!obj) return [{ kind: "text", text: raw }];
  return parseCopilotLine(obj);
}

/**
 * Default auto-detecting parser. Dispatches to the per-agent parser based on
 * the JSON `type` field. Kept for backward compatibility with callers that
 * don't have the agent tag available.
 */
export function parseAgentLine(raw: string): ContentBlock[] | null {
  const obj = parseJsonLine(raw);
  if (!obj) return [{ kind: "text", text: raw }];

  switch (obj.type) {
    case "system":
    case "assistant":
    case "user":
      return parseClaudeLine(obj);
    case "assistant.message":
    case "tool.execution_complete":
    case "tool.execution_partial_result":
      return parseCopilotLine(obj);
    case "result":
      return parseClaudeLine(obj) ?? parseCopilotLine(obj);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonLine(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractToolResultText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (
    content &&
    typeof content === "object" &&
    "text" in content &&
    typeof (content as Record<string, unknown>).text === "string"
  ) {
    return (content as Record<string, unknown>).text as string;
  }
  return null;
}
