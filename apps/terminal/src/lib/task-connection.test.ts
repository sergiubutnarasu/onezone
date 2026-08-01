import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventCommands, MessageRole } from '@onezone/shared';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  timeout: vi.fn(),
};

const mockCreateTaskSocket = vi.fn();
const mockSpawnCommand = vi.fn();
const mockTaskRunner = vi.fn();

vi.doMock('./task-socket.js', () => ({
  createTaskSocket: mockCreateTaskSocket,
}));

vi.doMock('./command-runner.js', () => ({
  spawnCommand: mockSpawnCommand,
}));

vi.doMock('./task-runner.js', () => ({
  taskRunner: mockTaskRunner,
}));

describe('task-connection', () => {
  let capturedCallbacks: any;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedCallbacks = {};
    mockCreateTaskSocket.mockImplementation((serverUrl, taskId, terminalId, terminalName, callbacks: any) => {
      capturedCallbacks = callbacks;
      return { socket: mockSocket, cleanup: vi.fn(), isClosed: () => false };
    });
    mockSpawnCommand.mockResolvedValue(undefined);
    mockTaskRunner.mockReturnValue(undefined);
    mockSocket.timeout.mockReturnValue(mockSocket);
    mockSocket.emit.mockReturnValue(mockSocket);
  });

  const createDeps = (overrides = {}) => ({
    serverUrl: 'http://localhost:3000',
    task: { id: 'task-1', name: 'Test Task', project: { id: 'p1' }, column: { id: 'c1', name: 'In Progress' } },
    terminalId: 'term-1',
    terminalName: 'Test',
    activeTaskIds: new Set<string>(),
    log: vi.fn(),
    ...overrides,
  });

  it('connects to task room and runs taskRunner on connect', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onConnect();
    expect(mockTaskRunner).toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Connected to'));
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('skips taskRunner when processes are already active (reconnect)', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onConnect();
    const args = mockTaskRunner.mock.calls[0] as unknown[];
    const activeProcesses = (args[0] as { activeProcesses: Map<string, unknown> }).activeProcesses;
    activeProcesses.set('job-1', { cleanup: vi.fn() });
    capturedCallbacks.onConnect();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Reconnected'));
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('handles TerminalCommandStop by cleaning up process', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onConnect();
    const args = mockTaskRunner.mock.calls[0] as unknown[];
    const activeProcesses = (args[0] as { activeProcesses: Map<string, { cleanup: () => void }> }).activeProcesses;
    const cleanup = vi.fn();
    activeProcesses.set('job-1', { cleanup });
    capturedCallbacks.onMessage(EventCommands.TerminalCommandStop, { jobId: 'job-1' });
    expect(cleanup).toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Stopping job'));
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('resolves when task is deleted', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects on io server disconnect with active task', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const activeTaskIds = new Set(['task-1']);
    const deps = createDeps({ activeTaskIds });
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onDisconnect('task:task-1', 'io server disconnect');
    await expect(promise).rejects.toThrow('Disconnected: io server disconnect');
  });

  it('resolves on io server disconnect when task is not active', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const activeTaskIds = new Set<string>();
    const deps = createDeps({ activeTaskIds });
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onDisconnect('task:task-1', 'io server disconnect');
    await expect(promise).resolves.toBeUndefined();
  });

  it('logs and reconnects on non-io disconnect with active processes', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onConnect();
    const args = mockTaskRunner.mock.calls[0] as unknown[];
    const activeProcesses = (args[0] as { activeProcesses: Map<string, unknown> }).activeProcesses;
    activeProcesses.set('job-1', { cleanup: vi.fn() });
    capturedCallbacks.onDisconnect('task:task-1', 'transport close');
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Disconnected (transport close), reconnecting'));
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('rejects on non-io disconnect without active processes', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onDisconnect('task:task-1', 'transport close');
    await expect(promise).rejects.toThrow('Disconnected: transport close');
  });

  it('handles TerminalCommandRun for user messages', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.TerminalCommandRun, {
      id: 'msg-1',
      role: MessageRole.User,
      content: 'hello',
    });
    expect(mockSpawnCommand).toHaveBeenCalled();
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('skips duplicate messages by id', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.TerminalCommandRun, {
      id: 'msg-1',
      role: MessageRole.User,
      content: 'hello',
    });
    capturedCallbacks.onMessage(EventCommands.TerminalCommandRun, {
      id: 'msg-1',
      role: MessageRole.User,
      content: 'hello',
    });
    expect(mockSpawnCommand).toHaveBeenCalledTimes(1);
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('handles TaskColumnUpdated with completed task', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.TaskColumnUpdated, {
      task: { id: 'task-1', name: 'Test', completedAt: new Date().toISOString() },
    });
    await expect(promise).resolves.toBeUndefined();
  });

  it('handles TaskColumnUpdated for non-completed task', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onConnect();
    expect(mockTaskRunner).toHaveBeenCalledTimes(1);
    capturedCallbacks.onMessage(EventCommands.TaskColumnUpdated, {
      task: { id: 'task-1', name: 'Test', column: { id: 'c2', name: 'Done' } },
    });
    expect(mockTaskRunner).toHaveBeenCalledTimes(2);
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('ignores empty content in TerminalCommandRun', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.TerminalCommandRun, {
      id: 'msg-1',
      role: MessageRole.User,
      content: '   ',
    });
    expect(mockSpawnCommand).not.toHaveBeenCalled();
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('ignores non-user messages in TerminalCommandRun', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.TerminalCommandRun, {
      id: 'msg-1',
      role: MessageRole.Assistant,
      content: 'hello',
    });
    expect(mockSpawnCommand).not.toHaveBeenCalled();
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('logs spawnCommand errors', async () => {
    mockSpawnCommand.mockRejectedValue(new Error('spawn failed'));
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.TerminalCommandRun, {
      id: 'msg-1',
      role: MessageRole.User,
      content: 'hello',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('spawnCommand error: spawn failed'));
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });

  it('logs connection errors', async () => {
    const { connectToTask } = await import('./task-connection.js');
    const deps = createDeps();
    const promise = connectToTask(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onConnectError('task:task-1', new Error('network down'));
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Connection failed (network down)'));
    capturedCallbacks.onMessage(EventCommands.TaskDeleted, { task: { id: 'task-1' } });
    await promise;
  });
});
