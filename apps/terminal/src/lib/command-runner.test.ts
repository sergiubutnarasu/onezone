import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventCommands, MessageStream } from '@onezone/shared';
import type { Socket } from 'socket.io-client';

const mockSocket = {
  connected: false,
  emit: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  timeout: vi.fn(),
} as unknown as Socket;

const mockSetupTerminalAgent = vi.fn();
const mockSetupProject = vi.fn();
const mockRandomUUID = vi.fn();

vi.doMock('../agents/setup.js', () => ({
  setupTerminalAgent: (...args: unknown[]) => mockSetupTerminalAgent(...args),
}));

vi.doMock('./setup.js', () => ({
  setupProject: (...args: unknown[]) => mockSetupProject(...args),
}));

vi.doMock('node:crypto', () => ({
  randomUUID: () => mockRandomUUID(),
}));

describe('command-runner', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSetupTerminalAgent.mockReset();
    mockSetupProject.mockReset();
    mockRandomUUID.mockReturnValue('job-123');
  });

  function createDeps(overrides?: Partial<Record<string, unknown>>) {
    return {
      socket: mockSocket,
      roomId: 'task:task-1',
      terminalId: 'term-1',
      terminalName: 'TestTerm',
      log: vi.fn(),
      isSocketClosed: vi.fn().mockReturnValue(false),
      ...overrides,
    };
  }

  describe('waitForSocketConnect', () => {
    it('returns true immediately if already connected', async () => {
      mockSocket.connected = true;
      const { spawnCommand } = await import('./command-runner.js');
      // Just verify it doesn't throw when socket is connected at start
      mockSetupTerminalAgent.mockReturnValue(null);
      const deps = createDeps();
      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });
      // no timeout needed because socket.connected = true
    });

    it('resolves false when socket timeout fires', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockSocket.connected = false;
      let timeoutCb: (() => void) | undefined;
      (mockSocket as unknown as Record<string, unknown>).once = vi.fn((event: string, cb: () => void) => {
        if (event === 'connect') timeoutCb = cb;
      });

      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue(null);
      const deps = createDeps();
      const promise = spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });
      vi.advanceTimersByTime(6000);
      await promise;
      vi.useRealTimers();
    });
  });

  describe('spawnCommand', () => {
    it('returns early when no terminal agent configured', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue(null);
      const deps = createDeps();
      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });
      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('No terminal agent configured'));
      expect(mockSocket.emit).not.toHaveBeenCalledWith(EventCommands.TerminalCommandStart, expect.anything());
    });

    it('calls emitSetupLine during setupProject', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      // Make setupProject call the emitSetupLine callback
      mockSetupProject.mockImplementation((_payload: unknown, emitSetupLine: (msg: string) => void) => {
        emitSetupLine('setup line 1');
        emitSetupLine('setup line 2');
        return Promise.resolve({ projectWorkDir: '/tmp/project' });
      });

      const deps = createDeps();
      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });

      const setupLineCalls = (mockSocket.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[1]?.content?.includes('setup line'),
      );
      expect(setupLineCalls.length).toBe(2);
    });

    it('triggers runAbortController.abort in second cleanup', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue({ projectWorkDir: '/tmp/project' });

      const runEvents: Array<{ type: string }> = [
        { type: 'text', content: 'hello' },
      ];
      const mockRun = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const event of runEvents) {
            yield event;
          }
        },
      });

      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: { run: mockRun },
      });

      const activeProcesses = new Map<string, { cleanup: () => void }>();
      const deps = createDeps();
      const promise = spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses });

      // Wait until setup succeeds and second cleanup is registered
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeProcesses.forEach((p) => p.cleanup());
      await promise;
    });

    it('emits start and exits when setupProject fails', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue(null);

      const deps = createDeps();
      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        EventCommands.TerminalCommandStart,
        expect.objectContaining({ command: 'echo hi', jobId: 'job-123' }),
      );
      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Failed to setup project environment'));
    });

    it('emits start and exits when setupProject fails after cancellation', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue(null);

      const activeProcesses = new Map<string, { cleanup: () => void }>();
      const deps = createDeps();
      const promise = spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses });
      // Cancel before promise resolves
      activeProcesses.forEach((p) => p.cleanup());
      await promise;

      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Failed to setup project environment'));
    });

    it('streams Text and Stderr events and emits exit with code 0', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue({ projectWorkDir: '/tmp/project' });

      const runEvents: Array<{ type: string; content?: string; usage?: Record<string, unknown> }> = [
        { type: 'text', content: 'hello' },
        { type: 'usage', usage: { totalCostUsd: 0.01 } },
        { type: 'stderr', content: 'warning' },
        { type: 'result', usage: { totalCostUsd: 0.02 } },
      ];

      const mockRun = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const event of runEvents) {
            yield event;
          }
        },
      });

      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: { run: mockRun },
      });

      const deps = createDeps();
      mockSocket.connected = true;
      (mockSocket as unknown as Record<string, unknown>).timeout = vi.fn().mockReturnValue({
        emit: vi.fn((_event: string, _payload: unknown, cb: (err: null, response: { status: string }) => void) => {
          cb(null, { status: 'ok' });
        }),
      });

      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });

      const stdoutCalls = (mockSocket.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[1]?.stream === MessageStream.Stdout,
      );
      expect(stdoutCalls.some((call: unknown[]) => call[1].content === 'hello')).toBe(true);

      const stderrCalls = (mockSocket.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[1]?.stream === MessageStream.Stderr,
      );
      expect(stderrCalls.some((call: unknown[]) => call[1].content === 'warning')).toBe(true);

      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('done'));
    });

    it('handles agent run errors and emits stderr line', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue({ projectWorkDir: '/tmp/project' });

      const mockRun = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          throw new Error('agent crashed');
        },
      });

      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: { run: mockRun },
      });

      const deps = createDeps();
      mockSocket.connected = true;
      (mockSocket as unknown as Record<string, unknown>).timeout = vi.fn().mockReturnValue({
        emit: vi.fn((_event: string, _payload: unknown, cb: (err: null, response: { status: string }) => void) => {
          cb(null, { status: 'ok' });
        }),
      });

      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });

      const stderrCalls = (mockSocket.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[1]?.stream === MessageStream.Stderr,
      );
      expect(stderrCalls.some((call: unknown[]) => call[1].content?.includes('agent crashed'))).toBe(true);
      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('error'));
    });

    it('suppresses error output when cancelled', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue({ projectWorkDir: '/tmp/project' });

      const mockRun = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          throw new Error('agent crashed');
        },
      });

      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: { run: mockRun },
      });

      const activeProcesses = new Map<string, { cleanup: () => void }>();
      const deps = createDeps();
      const promise = spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses });
      activeProcesses.forEach((p) => p.cleanup());
      await promise;

      const stderrCalls = (mockSocket.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[1]?.stream === MessageStream.Stderr,
      );
      expect(stderrCalls.some((call: unknown[]) => call[1].content?.includes('agent crashed'))).toBe(false);
    });

    it('emits exit code 130 when cancelled without result', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue({ projectWorkDir: '/tmp/project' });

      const mockRun = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          // No events - cancelled before result
          return;
        },
      });

      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: { run: mockRun },
      });

      const activeProcesses = new Map<string, { cleanup: () => void }>();
      const deps = createDeps();
      const promise = spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses });
      activeProcesses.forEach((p) => p.cleanup());
      await promise;

      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('error (130)'));
    });

    it('handles taskRunner mode with finished result', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue({ projectWorkDir: '/tmp/project' });

      const mockRun = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: 'result', finished: true, nextColumnId: 'col-done', usage: { totalCostUsd: 0.05 } };
        },
      });

      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: { run: mockRun },
      });

      const deps = createDeps();
      mockSocket.connected = true;
      const timeoutEmitMock = vi.fn((_event: string, _payload: unknown, cb: (err: null, response: { status: string }) => void) => {
        cb(null, { status: 'ok' });
      });
      (mockSocket as unknown as Record<string, unknown>).timeout = vi.fn().mockReturnValue({
        emit: timeoutEmitMock,
      });

      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map(), isTaskRunner: true });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const exitCalls = timeoutEmitMock.mock.calls.filter(
        (call: unknown[]) => call[0] === EventCommands.TerminalCommandExit,
      );
      expect(exitCalls.length).toBeGreaterThan(0);
      const lastExit = exitCalls[exitCalls.length - 1][1];
      expect(lastExit).toMatchObject({
        exitCode: 0,
        taskRunnerFinished: true,
        nextColumnId: 'col-done',
        totalCostUsd: 0.05,
      });
    });

    it('retries emitCommandExitUntilAck until acknowledged', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue({ projectWorkDir: '/tmp/project' });

      const mockRun = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: 'result' };
        },
      });

      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: { run: mockRun },
      });

      let ackCount = 0;
      const deps = createDeps();
      mockSocket.connected = true;
      (mockSocket as unknown as Record<string, unknown>).timeout = vi.fn().mockReturnValue({
        emit: vi.fn((_event: string, _payload: unknown, cb: (err: Error | null, response?: { status: string }) => void) => {
          ackCount++;
          if (ackCount <= 3) {
            cb(new Error('timeout'));
          } else {
            cb(null, { status: 'ok' });
          }
        }),
      });

      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(ackCount).toBeGreaterThanOrEqual(4);
      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('retrying'));
    });

    it('stops retrying when socket is closed', async () => {
      const { spawnCommand } = await import('./command-runner.js');
      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: {},
      });
      mockSetupProject.mockResolvedValue({ projectWorkDir: '/tmp/project' });

      const mockRun = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { type: 'result' };
        },
      });

      mockSetupTerminalAgent.mockReturnValue({
        agentId: 'agent-1',
        agentName: 'Claude',
        model: 'claude-model',
        config: { run: mockRun },
      });

      const isSocketClosed = vi.fn().mockReturnValue(false);
      const deps = createDeps({ isSocketClosed });
      mockSocket.connected = true;
      let emitCount = 0;
      (mockSocket as unknown as Record<string, unknown>).timeout = vi.fn().mockReturnValue({
        emit: vi.fn((_event: string, _payload: unknown, cb: (err: Error | null) => void) => {
          emitCount++;
          isSocketClosed.mockReturnValue(true);
          cb(new Error('timeout'));
        }),
      });

      await spawnCommand({ content: 'echo hi', payload: {}, deps, activeProcesses: new Map() });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(emitCount).toBe(1);
    });
  });
});
