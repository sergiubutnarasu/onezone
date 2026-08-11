import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createAcpClient, type AcpClient } from './client.js';

// Point the client at the fake ACP agent fixture instead of the real adapter.
// The path is resolved inside the factory because vi.mock is hoisted above
// module-level consts.
vi.mock('./entry.js', () => ({
  resolveAgentEntry: () =>
    fileURLToPath(new URL('../../../test/fixtures/fake-acp-agent.mjs', import.meta.url)),
}));

const MODEL = 'kimi-k2.6:cloud';

describe('createAcpClient (integration)', () => {
  let client: AcpClient;

  beforeAll(async () => {
    client = await createAcpClient({
      cwd: process.cwd(),
      workDir: process.cwd(),
      configPath: process.cwd(),
      model: MODEL,
      env: { ...process.env },
    });
  });

  afterAll(async () => {
    await client.dispose();
  });

  it('creates a session and captures the model via _meta', () => {
    expect(client.sessionId).toMatch(/^sess_/);
  });

  it('streams updates to the handler during prompt', async () => {
    const updates: Record<string, unknown>[] = [];
    client.onUpdate((u) => updates.push(u));

    const result = await client.prompt('hello');

    // The fake agent echoes the model it saw on session/new, proving the
    // `_meta.claudeCode.options.settings.model` value reached the agent.
    expect(result).toBe(`hello from fake (model: ${MODEL})`);
    expect(updates.some((u) => u.sessionUpdate === 'agent_message_chunk')).toBe(true);
    expect(updates.some((u) => u.sessionUpdate === 'usage_update')).toBe(true);
  });
});
