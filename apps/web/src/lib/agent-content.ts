// Parses a single line of an agent's stdout output and extracts displayable
// content blocks.  All agents now emit the same unified JSON-array format
// (UnifiedContentBlock[]), so this file no longer branches on agent type.

import type { UnifiedContentBlock } from "@onezone/shared";

export type ContentBlock = UnifiedContentBlock;
export type AgentContentParser = (raw: string) => ContentBlock[] | null;

const COMMAND_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console", "terminal"]);
const DIFF_LANGUAGES = new Set(["diff", "patch"]);

// ---------------------------------------------------------------------------
// Unified parser (agent-agnostic)
// ---------------------------------------------------------------------------

export function parseAgentLine(raw: string): ContentBlock[] | null {
  const blocks = parseJsonLine(raw);
  if (!blocks) return normalizeTextBlocks(raw, "raw");

  if (!Array.isArray(blocks)) return null;

  const result: ContentBlock[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    const b = block as Record<string, unknown>;
    const kind = b.kind;

    if (kind === "text" && typeof b.text === "string" && b.text.trim()) {
      result.push(...normalizeTextBlocks(b.text, "text"));
    } else if (kind === "thinking" && typeof b.text === "string" && b.text.trim()) {
      result.push({ kind: "thinking", text: b.text });
    } else if (kind === "tool_use" && typeof b.name === "string") {
      result.push({ kind: "tool_use", name: b.name, input: (b.input as Record<string, unknown>) ?? {} });
    } else if (kind === "tool_result" && typeof b.text === "string" && b.text.trim()) {
      result.push(...normalizeTextBlocks(b.text, "tool_result"));
    } else if (kind === "command" && typeof b.command === "string" && b.command.trim()) {
      result.push({ kind: "command", command: b.command, language: stringValue(b.language), title: stringValue(b.title) });
    } else if (kind === "diff" && typeof b.diff === "string" && b.diff.trim()) {
      result.push({ kind: "diff", diff: b.diff, title: stringValue(b.title) });
    } else if (kind === "raw" && typeof b.text === "string" && b.text.trim()) {
      result.push(...normalizeTextBlocks(b.text, "raw"));
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

function normalizeTextBlocks(text: string, fallbackKind: "text" | "tool_result" | "raw"): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const fencePattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let cursor = 0;

  for (const match of text.matchAll(fencePattern)) {
    const index = match.index ?? 0;
    appendTextBlock(blocks, text.slice(cursor, index), fallbackKind);

    const info = match[1]?.trim() ?? "";
    const language = info.split(/\s+/)[0]?.toLowerCase() ?? "";
    const body = match[2] ?? "";

    if (COMMAND_LANGUAGES.has(language) || (!language && looksLikeShellCommands(body))) {
      blocks.push({ kind: "command", command: body.trim(), language: language || undefined });
    } else if (DIFF_LANGUAGES.has(language)) {
      blocks.push({ kind: "diff", diff: body.trimEnd() });
    } else {
      appendTextBlock(blocks, match[0], fallbackKind);
    }

    cursor = index + match[0].length;
  }

  appendTextBlock(blocks, text.slice(cursor), fallbackKind);
  return blocks.length > 0 ? blocks : [{ kind: fallbackKind, text }];
}

function appendTextBlock(blocks: ContentBlock[], text: string, kind: "text" | "tool_result" | "raw") {
  if (!text.trim()) return;
  blocks.push({ kind, text });
}

function looksLikeShellCommands(text: string): boolean {
  const executableLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (executableLines.length === 0) return false;

  return executableLines.every((line) =>
    /^(?:[A-Z_][A-Z0-9_]*=\S+\s+)*(?:pnpm|npm|npx|yarn|bun|node|tsx|tsc|turbo|git|docker|docker-compose|cd|mkdir|cp|mv|rm|cat|sed|awk|grep|rg|find|curl|wget|python3?|pip3?|go|cargo|make|onezone-terminal|prisma)\b/.test(
      line,
    ),
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
