import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveAgentEntry } from './entry.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return { ...actual, existsSync: vi.fn(), realpathSync: vi.fn() };
});
import * as fs from 'node:fs';

const existsSync = vi.mocked(fs.existsSync);
const realpathSync = vi.mocked(fs.realpathSync);

afterEach(() => vi.clearAllMocks());

describe('resolveAgentEntry', () => {
  it('returns the first existing candidate', () => {
    existsSync.mockReturnValue(true);
    realpathSync.mockImplementation((p) => String(p));
    const entry = resolveAgentEntry();
    expect(typeof entry).toBe('string');
    expect(entry.length).toBeGreaterThan(0);
  });

  it('throws when no candidate exists', () => {
    existsSync.mockReturnValue(false);
    expect(() => resolveAgentEntry()).toThrow(/claude-agent-acp/i);
  });
});
