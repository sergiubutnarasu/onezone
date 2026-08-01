import { describe, it, expect } from 'vitest';
import { toAgentTag } from './agent-tag.js';
import { AgentTag } from '@onezone/shared';

describe('toAgentTag', () => {
  it('casts a string to AgentTag', () => {
    const result = toAgentTag('ClaudeCode');
    expect(result).toBe('ClaudeCode' as AgentTag);
  });

  it('accepts any string value', () => {
    const result = toAgentTag('SomeCustomTag');
    expect(result).toBe('SomeCustomTag' as AgentTag);
  });

  it('preserves the input string value', () => {
    expect(toAgentTag('copilot')).toBe('copilot' as AgentTag);
  });
});
