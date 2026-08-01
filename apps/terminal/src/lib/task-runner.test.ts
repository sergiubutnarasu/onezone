import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BYPASS_RUNNER_PROMPT_PREFIX, RUNNER_PROMPT_PREFIX } from '@onezone/shared';

const mockSpawnCommand = vi.fn();

vi.doMock('./command-runner.js', () => ({
  spawnCommand: mockSpawnCommand,
}));

describe('taskRunner', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSpawnCommand.mockResolvedValue(undefined);
  });

  it('logs and returns when task is not an object', async () => {
    const { taskRunner } = await import('./task-runner.js');
    const log = vi.fn();
    taskRunner({ payload: { task: 'invalid' }, deps: { roomId: 'room-1', terminalName: 'Test', log }, activeProcesses: new Map() });
    expect(log).toHaveBeenCalledWith('[Test] [room-1] Invalid task payload, skipping command execution.');
    expect(mockSpawnCommand).not.toHaveBeenCalled();
  });

  it('logs and returns when task has no column', async () => {
    const { taskRunner } = await import('./task-runner.js');
    const log = vi.fn();
    taskRunner({ payload: { task: { id: 't1', name: 'Task', project: { id: 'p1' } } }, deps: { roomId: 'room-1', terminalName: 'Test', log }, activeProcesses: new Map() });
    expect(log).toHaveBeenCalledWith('[Test] [room-1] Task is in Backlog, skipping command execution.');
    expect(mockSpawnCommand).not.toHaveBeenCalled();
  });

  it('logs and returns when task is completed', async () => {
    const { taskRunner } = await import('./task-runner.js');
    const log = vi.fn();
    taskRunner({ payload: { task: { id: 't1', name: 'Task', column: { id: 'c1' }, completedAt: new Date().toISOString(), project: { id: 'p1' } } }, deps: { roomId: 'room-1', terminalName: 'Test', log }, activeProcesses: new Map() });
    expect(log).toHaveBeenCalledWith('[Test] [room-1] Task is completed, skipping command execution.');
    expect(mockSpawnCommand).not.toHaveBeenCalled();
  });

  it('spawns bypass command when task.bypass is true', async () => {
    const { taskRunner } = await import('./task-runner.js');
    const log = vi.fn();
    const deps = { roomId: 'room-1', terminalName: 'Test', log, serverUrl: 'http://localhost:3000' };
    taskRunner({
      payload: { task: { id: 't1', name: 'Task', description: 'Desc', column: { id: 'c1', name: 'Done' }, bypass: true, project: { id: 'p1' } } },
      deps,
      activeProcesses: new Map(),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockSpawnCommand).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining(BYPASS_RUNNER_PROMPT_PREFIX),
      isTaskRunner: true,
    }));
  });

  it('spawns normal command with column details', async () => {
    const { taskRunner } = await import('./task-runner.js');
    const log = vi.fn();
    const deps = { roomId: 'room-1', terminalName: 'Test', log, serverUrl: 'http://localhost:3000' };
    taskRunner({
      payload: { task: { id: 't1', name: 'Task', description: 'Desc', column: { id: 'c1', name: 'In Progress', instructions: 'Do it' }, columnId: 'c1', project: { id: 'p1' } } },
      deps,
      activeProcesses: new Map(),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockSpawnCommand).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining(RUNNER_PROMPT_PREFIX),
      isTaskRunner: true,
    }));
    const content = (mockSpawnCommand.mock.calls[0][0] as { content: string }).content;
    expect(content).toContain('"kanbanColumnName":"In Progress"');
    expect(content).toContain('"kanbanColumnInstructions":"Do it"');
  });

  it('handles spawnCommand error', async () => {
    mockSpawnCommand.mockRejectedValue(new Error('spawn error'));
    const { taskRunner } = await import('./task-runner.js');
    const log = vi.fn();
    const deps = { roomId: 'room-1', terminalName: 'Test', log, serverUrl: 'http://localhost:3000' };
    taskRunner({
      payload: { task: { id: 't1', name: 'Task', column: { id: 'c1', name: 'Done' }, project: { id: 'p1' } } },
      deps,
      activeProcesses: new Map(),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(log).toHaveBeenCalledWith('[Test] [room-1] spawnCommand error: spawn error');
  });
});
