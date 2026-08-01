import { describe, it, expect, vi } from 'vitest';
import { parseRunnerCommand } from './runner-command.js';

vi.mock('@onezone/shared', () => ({
  parseRunnerPayload: vi.fn(),
}));

import { parseRunnerPayload } from '@onezone/shared';

describe('parseRunnerCommand', () => {
  it('returns parsed payload when shared parser succeeds', () => {
    const payload = { taskName: 'test-task', kanbanColumnName: 'todo' };
    vi.mocked(parseRunnerPayload).mockReturnValue(payload);
    expect(parseRunnerCommand('some command')).toEqual(payload);
    expect(parseRunnerPayload).toHaveBeenCalledWith('some command');
  });

  it('returns null when shared parser returns null', () => {
    vi.mocked(parseRunnerPayload).mockReturnValue(null);
    expect(parseRunnerCommand('some command')).toBeNull();
  });

  it('passes the command through to shared parser', () => {
    vi.mocked(parseRunnerPayload).mockReturnValue({ taskName: 'x' });
    parseRunnerCommand('runner payload');
    expect(parseRunnerPayload).toHaveBeenCalledWith('runner payload');
  });
});
