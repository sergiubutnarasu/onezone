import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventCommands } from '@onezone/shared';
import { IO_SERVER_DISCONNECT } from './constants.js';

const mockCreateLobbySocket = vi.fn();
const mockRunProjectBuilderCommand = vi.fn();

vi.doMock('./task-socket.js', () => ({
  createLobbySocket: (...args: unknown[]) => mockCreateLobbySocket(...args),
}));

vi.doMock('./project-builder-command-runner.js', () => ({
  runProjectBuilderCommand: (...args: unknown[]) => mockRunProjectBuilderCommand(...args),
}));

describe('lobby-connection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRunProjectBuilderCommand.mockReset();
  });

  function createDeps(overrides?: Partial<Record<string, unknown>>) {
    return {
      serverUrl: 'http://localhost:3000',
      terminalId: 'term-1',
      terminalName: 'TestTerm',
      activeTaskIds: new Set<string>(),
      onTaskAssigned: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
      ...overrides,
    };
  }

  it('logs connection on connect', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onConnect();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Connected to'));
  });

  it('handles ProjectBuilderCommand event', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    const mockSocket = { emit: vi.fn() };
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: mockSocket, cleanup: vi.fn() };
    });

    mockRunProjectBuilderCommand.mockResolvedValue(undefined);

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.ProjectBuilderCommand, {
      commandId: 'cmd-1',
      projectId: 'proj-1',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockRunProjectBuilderCommand).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'cmd-1', projectId: 'proj-1' }),
      expect.objectContaining({
        serverUrl: 'http://localhost:3000',
        terminalId: 'term-1',
        terminalName: 'TestTerm',
        signal: expect.any(AbortSignal),
        log: deps.log,
      }),
    );
    // Success path does not emit finished (code only emits on failure)
    expect(deps.log).not.toHaveBeenCalledWith(expect.stringContaining('failed'));
  });

  it('handles ProjectBuilderCommand failure', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    const mockSocket = { emit: vi.fn() };
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: mockSocket, cleanup: vi.fn() };
    });

    mockRunProjectBuilderCommand.mockRejectedValue(new Error('build failed'));

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.ProjectBuilderCommand, {
      commandId: 'cmd-1',
      projectId: 'proj-1',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('failed: build failed'));
    expect(mockSocket.emit).toHaveBeenCalledWith(
      EventCommands.ProjectBuilderCommandFinished,
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('ignores ProjectBuilderCommand failure when aborted', async () => {
    const OriginalAbortController = globalThis.AbortController;
    globalThis.AbortController = class extends OriginalAbortController {
      constructor() {
        super();
        this.abort();
      }
    } as typeof AbortController;

    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    const mockSocket = { emit: vi.fn() };
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: mockSocket, cleanup: vi.fn() };
    });

    mockRunProjectBuilderCommand.mockRejectedValue(new Error('aborted'));

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.ProjectBuilderCommand, {
      commandId: 'cmd-1',
      projectId: 'proj-1',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    // When aborted, the error handler returns early, so no failure log/emit
    expect(mockSocket.emit).not.toHaveBeenCalledWith(
      EventCommands.ProjectBuilderCommandFinished,
      expect.objectContaining({ status: 'failed' }),
    );

    globalThis.AbortController = OriginalAbortController;
  });

  it('handles ProjectBuilderCommandStop event', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    const mockSocket = { emit: vi.fn() };
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: mockSocket, cleanup: vi.fn() };
    });

    mockRunProjectBuilderCommand.mockImplementation((_payload: unknown, opts: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Start a command first
    capturedCallbacks.onMessage(EventCommands.ProjectBuilderCommand, {
      commandId: 'cmd-1',
      projectId: 'proj-1',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Then stop it
    capturedCallbacks.onMessage(EventCommands.ProjectBuilderCommandStop, {
      projectId: 'proj-1',
    });

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Stopping project builder'));
  });

  it('handles AssignTask event', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.AssignTask, { task: { id: 'task-1', completedAt: null } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Assigned to task: task-1'));
    expect(deps.onTaskAssigned).toHaveBeenCalledWith({ id: 'task-1', completedAt: null });
  });

  it('skips already active tasks', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const activeTaskIds = new Set(['task-1']);
    const deps = createDeps({ activeTaskIds });
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.AssignTask, { task: { id: 'task-1', completedAt: null } });

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Already connected to task'));
    expect(deps.onTaskAssigned).not.toHaveBeenCalled();
  });

  it('skips completed tasks', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.AssignTask, { task: { id: 'task-1', completedAt: '2024-01-01' } });

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('is completed, skipping'));
    expect(deps.onTaskAssigned).not.toHaveBeenCalled();
  });

  it('handles task assignment failure', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const activeTaskIds = new Set<string>();
    const deps = createDeps({
      activeTaskIds,
      onTaskAssigned: vi.fn().mockRejectedValue(new Error('connection refused')),
    });
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.AssignTask, { task: { id: 'task-1', completedAt: null } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('connection failed: connection refused'));
    expect(activeTaskIds.has('task-1')).toBe(false);
  });

  it('logs connect errors', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onConnectError('lobby', new Error('ECONNREFUSED'));

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Lobby connection failed (ECONNREFUSED), retrying'));
  });

  it('rejects on io server disconnect', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const deps = createDeps();
    const promise = connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onDisconnect('lobby', IO_SERVER_DISCONNECT);

    await expect(promise).rejects.toThrow('Lobby disconnected: io server disconnect');
  });

  it('logs and reconnects on non-io disconnect', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onDisconnect('lobby', 'transport close');

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Lobby disconnected (transport close), reconnecting'));
  });

  it('ignores non-AssignTask non-Stop events', async () => {
    const { connectToLobby } = await import('./lobby-connection.js');
    const capturedCallbacks: Record<string, unknown> = {};
    mockCreateLobbySocket.mockImplementation((_url: string, _tid: string, _tname: string, callbacks: Record<string, unknown>) => {
      Object.assign(capturedCallbacks, callbacks);
      return { socket: { emit: vi.fn() }, cleanup: vi.fn() };
    });

    const deps = createDeps();
    connectToLobby(deps);
    await new Promise((resolve) => setTimeout(resolve, 10));
    capturedCallbacks.onMessage(EventCommands.TaskColumnUpdated, { task: { id: 'task-1' } });

    expect(deps.onTaskAssigned).not.toHaveBeenCalled();
    expect(deps.log).not.toHaveBeenCalledWith(expect.stringContaining('Lobby received unknown event'));
  });
});
