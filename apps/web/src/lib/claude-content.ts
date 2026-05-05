// Parses a single line of Claude's --output-format stream-json output
// and extracts displayable content blocks.

export type ContentBlock =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool_use'; name: string; input: Record<string, unknown> }
  | { kind: 'tool_result'; text: string }
  | { kind: 'raw'; text: string };

export function parseClaudeLine(raw: string): ContentBlock[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not JSON — return as raw text
    return [{ kind: 'raw', text: raw }];
  }

  if (!parsed || typeof parsed !== 'object') {
    return [{ kind: 'raw', text: raw }];
  }

  const obj = parsed as Record<string, unknown>;

  // Skip system/init messages entirely
  if (obj.type === 'system') return null;

  // Assistant messages — extract content blocks
  if (obj.type === 'assistant') {
    const message = obj.message as Record<string, unknown> | undefined;
    const contentBlocks = message?.content as unknown[] | undefined;
    if (!Array.isArray(contentBlocks)) return null;

    const result: ContentBlock[] = [];
    for (const block of contentBlocks) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;

      if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        result.push({ kind: 'text', text: b.text });
      } else if (b.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim()) {
        result.push({ kind: 'thinking', text: b.thinking });
      } else if (b.type === 'tool_use' && typeof b.name === 'string') {
        result.push({ kind: 'tool_use', name: b.name, input: (b.input as Record<string, unknown>) ?? {} });
      }
    }
    return result.length > 0 ? result : null;
  }

  // User messages — extract tool results
  if (obj.type === 'user') {
    const message = obj.message as Record<string, unknown> | undefined;
    const contentBlocks = message?.content as unknown[] | undefined;
    if (!Array.isArray(contentBlocks)) return null;

    const result: ContentBlock[] = [];
    for (const block of contentBlocks) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;

      if (b.type === 'tool_result') {
        const text = extractToolResultText(b.content);
        if (text) result.push({ kind: 'tool_result', text });
      }
    }
    return result.length > 0 ? result : null;
  }

  // Final result message
  if (obj.type === 'result' && typeof obj.result === 'string' && obj.result.trim()) {
    return [{ kind: 'text', text: obj.result }];
  }

  return null;
}

function extractToolResultText(content: unknown): string | null {
  if (typeof content === 'string') return content.trim() || null;

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (!item || typeof item !== 'object') continue;
      const i = item as Record<string, unknown>;
      if (i.type === 'text' && typeof i.text === 'string') {
        parts.push(i.text);
      }
    }
    return parts.join('\n').trim() || null;
  }

  return null;
}
