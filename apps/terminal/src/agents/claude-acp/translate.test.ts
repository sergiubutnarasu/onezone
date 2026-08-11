import { describe, it, expect } from 'vitest';
import { AgentEventType } from '../../lib/types/index.js';
import { translateUpdate, finishResult } from './translate.js';

describe('translateUpdate', () => {
  it('maps agent_message_chunk text', () => {
    const { blocks } = translateUpdate({
      sessionUpdate: 'agent_message_chunk',
      messageId: 'm1',
      content: { type: 'text', text: 'hello' },
    });
    expect(blocks).toEqual([{ kind: 'text', text: 'hello' }]);
  });

  it('maps thinking content', () => {
    const { blocks } = translateUpdate({
      sessionUpdate: 'agent_message_chunk',
      messageId: 'm2',
      content: { type: 'thinking', text: 'hmm' },
    });
    expect(blocks).toEqual([{ kind: 'thinking', text: 'hmm' }]);
  });

  it('maps tool_call to tool_use', () => {
    const { blocks } = translateUpdate({
      sessionUpdate: 'tool_call',
      toolCallId: 'c1',
      title: 'Bash',
      kind: 'execute',
      status: 'pending',
      rawInput: { command: 'ls' },
    });
    expect(blocks).toEqual([{ kind: 'tool_use', name: 'Bash', input: { command: 'ls' } }]);
  });

  it('maps completed tool_call_update to tool_result', () => {
    const { blocks } = translateUpdate({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'c1',
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: 'out' } }],
    });
    expect(blocks).toEqual([{ kind: 'tool_result', text: 'out' }]);
  });

  it('maps usage_update to a Usage event', () => {
    const { event } = translateUpdate({
      sessionUpdate: 'usage_update',
      used: 53000,
      size: 200000,
      cost: { amount: 0.045, currency: 'USD' },
    });
    expect(event).toEqual({
      type: AgentEventType.Usage,
      inputTokens: 53000,
      outputTokens: undefined,
    });
  });

  it('ignores config_option_update', () => {
    const result = translateUpdate({
      sessionUpdate: 'config_option_update',
      configOptions: [],
    });
    expect(result.blocks).toEqual([]);
    expect(result.event).toBeUndefined();
  });

  it('ignores unknown update kinds', () => {
    const result = translateUpdate({ sessionUpdate: 'plan', entries: [] });
    expect(result.blocks).toEqual([]);
    expect(result.event).toBeUndefined();
  });
});

describe('finishResult', () => {
  it('emits a finished Result and parses next column tag', () => {
    const text = 'done [[ONEZONE_NEXT_COLUMN:review]]';
    const evt = finishResult(text) as { type: AgentEventType.Result; content: string; nextColumnId: string; finished: boolean };
    expect(evt.type).toBe(AgentEventType.Result);
    expect(evt.content).toBe(text);
    expect(evt.nextColumnId).toBe('review');
    expect(evt.finished).toBe(true);
  });

  it('returns no nextColumn when tag is absent', () => {
    const evt = finishResult('plain') as { nextColumnId?: string };
    expect(evt.nextColumnId).toBeUndefined();
  });
});
