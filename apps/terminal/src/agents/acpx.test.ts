import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTag } from '@onezone/shared';
import { AgentEventType } from '../lib/types/index.js';

const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...a: unknown[]) => mockSpawn(...a) }));

const EXPECTED_POLICY =
  '{"defaultAction":"approve","autoApprove":["Bash(*)","Edit(/*)","Read(/*)","Write(/*)","Glob","Grep","WebSearch","WebFetch(domain:*)","Agent","TodoWrite"]}';

// A fake child process that emits NDJSON lines then closes.
function fakeChild(lines: string[]) {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const stdout = {
    setEncoding: vi.fn(),
    on: (ev: string, cb: (...args: unknown[]) => void) => {
      (listeners[ev] ??= []).push(cb);
    },
  };
  const child = {
    stdout,
    stderr: { setEncoding: vi.fn(), on: vi.fn() },
    on: (ev: string, cb: (...args: unknown[]) => void) => {
      (listeners[ev] ??= []).push(cb);
    },
    kill: vi.fn(),
  };
  // Emit lines on next tick
  setTimeout(() => {
    for (const line of lines) {
      for (const cb of listeners['data'] ?? []) cb(line + '\n');
    }
    for (const cb of listeners['close'] ?? []) cb(0, null);
  }, 0);
  return child;
}

import { setup } from './acpx.js';

describe('acpx adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps agent_message_chunk text to a Text event', async () => {
    mockSpawn.mockReturnValue(fakeChild([
      JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } } }),
    ]));
    const config = setup({ projectId: 'p1', model: 'claude-sonnet-4-6', agentName: 'claude' });
    const events: unknown[] = [];
    for await (const ev of config.run({ prompt: 'hi', cwd: '/w', signal: new AbortController().signal })) {
      events.push(ev);
    }
    expect(events).toContainEqual({ type: AgentEventType.Text, content: JSON.stringify([{ kind: 'text', text: 'Hello' }]) });
  });

  it('maps a result message to a Result event with nextColumnId', async () => {
    mockSpawn.mockReturnValue(fakeChild([
      JSON.stringify({ jsonrpc: '2.0', id: 'req-1', result: { stopReason: 'end_turn', result: 'done [[ONEZONE_NEXT_COLUMN:in-progress]]', usage: { input_tokens: 10, output_tokens: 5 }, total_cost_usd: 0.01 } }),
    ]));
    const config = setup({ projectId: 'p1', model: 'm', agentName: 'claude' });
    const events: unknown[] = [];
    for await (const ev of config.run({ prompt: 'hi', cwd: '/w', signal: new AbortController().signal })) {
      events.push(ev);
    }
    expect(events).toContainEqual(expect.objectContaining({
      type: AgentEventType.Result,
      nextColumnId: 'in-progress',
      finished: true,
    }));
  });

  it('places global flags before the agent subcommand and passes the model', async () => {
    mockSpawn.mockReturnValue(fakeChild([]));
    const config = setup({ projectId: 'p1', model: 'kimi-k2.6:cloud', agentName: 'claude' });
    const ac = new AbortController();
    const iter = config.run({ prompt: 'hi', cwd: '/w', signal: ac.signal })[Symbol.asyncIterator]();
    await iter.next();
    ac.abort();
    await iter.return?.();
    expect(mockSpawn).toHaveBeenCalledWith(
      'acpx',
      [
        '--format', 'json', '--json-strict',
        '--permission-policy', EXPECTED_POLICY,
        '--model', 'kimi-k2.6:cloud',
        'claude', 'exec', 'hi',
      ],
      expect.objectContaining({ cwd: '/w' }),
    );
  });

  it('omits --model when none is provided', async () => {
    mockSpawn.mockReturnValue(fakeChild([]));
    const config = setup({ projectId: 'p1', model: '', agentName: 'claude' });
    const ac = new AbortController();
    const iter = config.run({ prompt: 'hi', cwd: '/w', signal: ac.signal })[Symbol.asyncIterator]();
    await iter.next();
    ac.abort();
    await iter.return?.();
    expect(mockSpawn).toHaveBeenCalledWith(
      'acpx',
      [
        '--format', 'json', '--json-strict',
        '--permission-policy', EXPECTED_POLICY,
        'claude', 'exec', 'hi',
      ],
      expect.objectContaining({ cwd: '/w' }),
    );
  });

  it('surfaces a JSON-RPC error message as a Stderr event', async () => {
    mockSpawn.mockReturnValue(fakeChild([
      JSON.stringify({ jsonrpc: '2.0', id: 2, error: { code: -32603, message: "Internal error: There's an issue with the selected model (claude-opus-4-8[1m]). It may not exist or you may not have access to it.", data: { errorKind: 'model_not_found' } } }),
    ]));
    const config = setup({ projectId: 'p1', model: 'claude-opus-4-8[1m]', agentName: 'claude' });
    const events: unknown[] = [];
    for await (const ev of config.run({ prompt: 'hi', cwd: '/w', signal: new AbortController().signal })) {
      events.push(ev);
    }
    expect(events).toContainEqual({
      type: AgentEventType.Stderr,
      content: "acpx error: Internal error: There's an issue with the selected model (claude-opus-4-8[1m]). It may not exist or you may not have access to it. (code -32603)",
    });
  });

  it('kills the child on abort', async () => {
    const child = fakeChild([]);
    mockSpawn.mockReturnValue(child);
    const config = setup({ projectId: 'p1', model: 'm', agentName: 'claude' });
    const ac = new AbortController();
    const iter = config.run({ prompt: 'hi', cwd: '/w', signal: ac.signal })[Symbol.asyncIterator]();
    // Start the generator so abort listener is registered
    const nextPromise = iter.next();
    // Give it a tick to register the listener
    await new Promise(resolve => setTimeout(resolve, 10));
    ac.abort();
    await nextPromise;
    await iter.return?.();
    expect(child.kill).toHaveBeenCalled();
  });
});
