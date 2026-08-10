import type { UnifiedContentBlock } from '@onezone/shared';
import { AgentEventType, parseNextColumnTag, type AgentEvent } from '../../lib/types/index.js';

type AcpUpdate = Record<string, unknown>;

type UpdateResult = { blocks: UnifiedContentBlock[]; event?: AgentEvent };

function textBlock(text: string, kind: 'text' | 'thinking'): UnifiedContentBlock {
  return kind === 'text' ? { kind: 'text', text } : { kind: 'thinking', text };
}

function toolResultText(content: unknown): string {
  if (typeof content !== 'object' || content === null) return '';
  const arr = Array.isArray(content) ? content : [content];
  for (const item of arr) {
    if (typeof item !== 'object' || item === null) continue;
    const c = (item as { content?: unknown }).content;
    if (c && typeof c === 'object') {
      const inner = c as { text?: unknown };
      if (typeof inner.text === 'string') return inner.text;
    }
  }
  return '';
}

export function translateUpdate(update: AcpUpdate): UpdateResult {
  const kind = update.sessionUpdate;
  const blocks: UnifiedContentBlock[] = [];
  let event: AgentEvent | undefined;

  switch (kind) {
    case 'agent_message_chunk': {
      const content = update.content as { type?: string; text?: string } | undefined;
      const text = content?.text ?? '';
      if (!text.trim()) break;
      if (content?.type === 'thinking') blocks.push(textBlock(text, 'thinking'));
      else blocks.push(textBlock(text, 'text'));
      break;
    }
    case 'tool_call': {
      const title = typeof update.title === 'string' ? update.title : 'tool';
      const input = (update.rawInput as Record<string, unknown>) ?? {};
      blocks.push({ kind: 'tool_use', name: title, input });
      break;
    }
    case 'tool_call_update': {
      const status = update.status;
      if (status === 'completed' || status === 'failed') {
        const text = toolResultText(update.content);
        if (text) blocks.push({ kind: 'tool_result', text });
      }
      break;
    }
    case 'usage_update': {
      event = {
        type: AgentEventType.Usage,
        inputTokens: typeof update.used === 'number' ? update.used : undefined,
        outputTokens: undefined,
      };
      break;
    }
    default:
      break; // config_option_update, plan, etc. are no-ops
  }

  return { blocks, event };
}

export function finishResult(text: string): AgentEvent {
  return {
    type: AgentEventType.Result,
    content: text,
    nextColumnId: text ? parseNextColumnTag(text) : undefined,
    finished: true,
  };
}
