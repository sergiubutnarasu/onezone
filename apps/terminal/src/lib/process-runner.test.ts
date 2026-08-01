import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageStream } from '@onezone/shared';

const mockExecSync = vi.fn();
const mockSpawn = vi.fn();
const mockCreateInterface = vi.fn();

vi.doMock('node:child_process', () => ({
  execSync: mockExecSync,
  spawn: mockSpawn,
}));

vi.doMock('node:readline', () => ({
  createInterface: mockCreateInterface,
}));

describe('process-runner', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockExecSync.mockReset();
    mockSpawn.mockReset();
    mockCreateInterface.mockReset();
    // Default: no child processes
    mockExecSync.mockImplementation(() => { throw new Error('no children'); });
  });

  describe('getChildPids (via killTree)', () => {
    it('kills process tree with SIGTERM', async () => {
      const { killTree } = await import('./process-runner.js');
      // pid 1 has children 2,3; pid 2 has child 4; others have none
      mockExecSync.mockImplementation((cmd: string) => {
        const match = (cmd as string).match(/pgrep -P (\d+)/);
        const pid = match ? parseInt(match[1], 10) : 0;
        if (pid === 1) return '2\n3\n';
        if (pid === 2) return '4\n';
        throw new Error('no children');
      });
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      killTree(1, 'SIGTERM');
      expect(mockExecSync).toHaveBeenCalledWith('pgrep -P 1', { encoding: 'utf8' });
      expect(mockKill).toHaveBeenCalledWith(-1, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(1, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(-2, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(2, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(-4, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(4, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(-3, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(3, 'SIGTERM');
      mockKill.mockRestore();
    });

    it('handles pgrep failure gracefully', async () => {
      const { killTree } = await import('./process-runner.js');
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      killTree(1);
      expect(mockKill).toHaveBeenCalledWith(-1, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(1, 'SIGTERM');
      mockKill.mockRestore();
    });

    it('handles process.kill errors gracefully', async () => {
      const { killTree } = await import('./process-runner.js');
      mockExecSync.mockReturnValue('');
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => { throw new Error('EPERM'); });
      expect(() => killTree(1)).not.toThrow();
      mockKill.mockRestore();
    });
  });

  describe('terminateTree', () => {
    it('sends SIGTERM then SIGKILL after grace period', async () => {
      const { terminateTree } = await import('./process-runner.js');
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockExecSync.mockReturnValue('');
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      terminateTree(1);
      expect(mockKill).toHaveBeenCalledWith(-1, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(1, 'SIGTERM');
      vi.advanceTimersByTime(5001);
      expect(mockKill).toHaveBeenCalledWith(-1, 'SIGKILL');
      expect(mockKill).toHaveBeenCalledWith(1, 'SIGKILL');
      mockKill.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('registerCleanupHandlers', () => {
    it('registers process exit handlers', async () => {
      const { registerCleanupHandlers } = await import('./process-runner.js');
      const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      registerCleanupHandlers();
      expect(onSpy).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      onSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('killAll terminates active processes on SIGINT', async () => {
      const { registerCleanupHandlers, runProcess } = await import('./process-runner.js');
      const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      mockExecSync.mockReturnValue('');
      registerCleanupHandlers();

      // Spawn a process so activeProcs has entries
      const proc = {
        pid: 99,
        stdin: null,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockReturnValue({ on: vi.fn() });
      runProcess({ cmd: 'sleep', args: ['10'], cwd: '/tmp' });

      // Get the SIGINT handler and call it
      const sigintHandler = onSpy.mock.calls.find((call) => call[0] === 'SIGINT')?.[1] as () => void;
      expect(sigintHandler).toBeDefined();
      sigintHandler();

      expect(mockKill).toHaveBeenCalledWith(-99, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(99, 'SIGTERM');

      onSpy.mockRestore();
      exitSpy.mockRestore();
      mockKill.mockRestore();
    });

    it('killAll terminates active processes on SIGTERM', async () => {
      const { registerCleanupHandlers, runProcess } = await import('./process-runner.js');
      const onSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      mockExecSync.mockReturnValue('');
      registerCleanupHandlers();

      // Spawn a process so activeProcs has entries
      const proc = {
        pid: 88,
        stdin: null,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockReturnValue({ on: vi.fn() });
      runProcess({ cmd: 'sleep', args: ['10'], cwd: '/tmp' });

      const sigtermHandler = onSpy.mock.calls.find((call) => call[0] === 'SIGTERM')?.[1] as () => void;
      expect(sigtermHandler).toBeDefined();
      sigtermHandler();

      expect(mockKill).toHaveBeenCalledWith(-88, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(88, 'SIGTERM');

      onSpy.mockRestore();
      exitSpy.mockRestore();
      mockKill.mockRestore();
    });
  });

  describe('runProcess', () => {
    it('spawns process with correct options', async () => {
      const { runProcess } = await import('./process-runner.js');
      const proc = {
        pid: 42,
        stdin: null,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockReturnValue({ on: vi.fn() });

      runProcess({ cmd: 'git', args: ['status'], cwd: '/tmp', shell: false });

      expect(mockSpawn).toHaveBeenCalledWith('git', ['status'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        detached: true,
        cwd: '/tmp',
      });
    });

    it('uses pipe stdio when onStdinReady provided', async () => {
      const { runProcess } = await import('./process-runner.js');
      const stdin = { writable: true, write: vi.fn() };
      const proc = {
        pid: 42,
        stdin,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockReturnValue({ on: vi.fn() });

      const onStdinReady = vi.fn();
      runProcess({ cmd: 'node', args: [], cwd: '/tmp', onStdinReady });

      expect(mockSpawn).toHaveBeenCalledWith('node', [], expect.objectContaining({
        stdio: ['pipe', 'pipe', 'pipe'],
      }));
    });

    it('warns when stdin is not writable', async () => {
      const { runProcess } = await import('./process-runner.js');
      const stdin = { writable: false, write: vi.fn() };
      const proc = {
        pid: 42,
        stdin,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockReturnValue({ on: vi.fn() });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      let writeFn: ((data: string) => void) | undefined;
      runProcess({
        cmd: 'node',
        args: [],
        cwd: '/tmp',
        onStdinReady: (write) => {
          writeFn = write;
        },
      });

      expect(writeFn).toBeDefined();
      writeFn!('test input');
      expect(warnSpy).toHaveBeenCalledWith('[process-runner] stdin not writable, dropping input: test input');

      warnSpy.mockRestore();
    });

    it('writes to stdin when writable', async () => {
      const { runProcess } = await import('./process-runner.js');
      const stdin = { writable: true, write: vi.fn() };
      const proc = {
        pid: 42,
        stdin,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockReturnValue({ on: vi.fn() });

      let writeFn: ((data: string) => void) | undefined;
      runProcess({
        cmd: 'node',
        args: [],
        cwd: '/tmp',
        onStdinReady: (write) => {
          writeFn = write;
        },
      });

      expect(writeFn).toBeDefined();
      writeFn!('test input');
      expect(stdin.write).toHaveBeenCalledWith('test input');
    });

    it('calls onLine with stdout and stderr lines', async () => {
      const { runProcess } = await import('./process-runner.js');
      const stdoutListeners: Array<(line: string) => void> = [];
      const stderrListeners: Array<(line: string) => void> = [];
      const proc = {
        pid: 42,
        stdin: null,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockImplementation(({ input }: { input: { on: typeof proc.stdout.on } }) => {
        const rl = {
          on: (event: string, cb: (line: string) => void) => {
            if (input === proc.stdout) stdoutListeners.push(cb);
            if (input === proc.stderr) stderrListeners.push(cb);
          },
        };
        return rl;
      });

      const onLine = vi.fn();
      runProcess({ cmd: 'echo', args: ['hello'], cwd: '/tmp', onLine });

      stdoutListeners.forEach((cb) => cb('hello stdout'));
      expect(onLine).toHaveBeenCalledWith(MessageStream.Stdout, 'hello stdout');
      stderrListeners.forEach((cb) => cb('hello stderr'));
      expect(onLine).toHaveBeenCalledWith(MessageStream.Stderr, 'hello stderr');
    });

    it('calls onExit with code on close', async () => {
      const { runProcess } = await import('./process-runner.js');
      const onCallbacks: Record<string, Array<(...args: unknown[]) => void>> = {};
      const proc = {
        pid: 42,
        stdin: null,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (!onCallbacks[event]) onCallbacks[event] = [];
          onCallbacks[event].push(cb);
        },
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockReturnValue({ on: vi.fn() });
      mockExecSync.mockReturnValue('');
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const onExit = vi.fn();
      runProcess({ cmd: 'echo', args: ['hello'], cwd: '/tmp', onExit });

      onCallbacks['close']?.forEach((cb) => cb(0));
      expect(onExit).toHaveBeenCalledWith(0);

      mockKill.mockRestore();
    });

    it('calls onExit with -1 on error', async () => {
      const { runProcess } = await import('./process-runner.js');
      const onCallbacks: Record<string, Array<(...args: unknown[]) => void>> = {};
      const proc = {
        pid: 42,
        stdin: null,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (!onCallbacks[event]) onCallbacks[event] = [];
          onCallbacks[event].push(cb);
        },
        once: vi.fn(),
      };
      mockSpawn.mockReturnValue(proc);
      mockCreateInterface.mockReturnValue({ on: vi.fn() });
      mockExecSync.mockReturnValue('');
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const onExit = vi.fn();
      const onLine = vi.fn();
      runProcess({ cmd: 'echo', args: ['hello'], cwd: '/tmp', onExit, onLine });

      onCallbacks['error']?.forEach((cb) => cb(new Error('spawn error')));
      expect(onExit).toHaveBeenCalledWith(-1);
      expect(onLine).toHaveBeenCalledWith(MessageStream.Stderr, 'Process error: spawn error');

      mockKill.mockRestore();
    });
  });
});
