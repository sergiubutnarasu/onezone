import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIo = vi.fn();
const mockGetAccessToken = vi.fn();
const mockHostname = vi.fn();

vi.doMock('socket.io-client', () => ({
  io: mockIo,
}));

vi.doMock('./config.js', () => ({
  getAccessToken: mockGetAccessToken,
}));

vi.doMock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    hostname: mockHostname,
  };
});

describe('createTerminalSocket', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetAccessToken.mockReset();
    mockHostname.mockReset();
    mockHostname.mockReturnValue('test-host');
    mockIo.mockReturnValue({ id: 'socket-123' });
  });

  it('creates socket with correct URL and options', async () => {
    const { createTerminalSocket } = await import('./socket-client.js');
    createTerminalSocket({
      serverUrl: 'http://localhost:3000',
      taskId: 'task-1',
      terminalId: 'term-1',
      terminalName: 'Test Terminal',
    });
    expect(mockIo).toHaveBeenCalledWith('http://localhost:3000/chat', expect.objectContaining({
      reconnection: true,
    }));
  });

  it('auth callback includes taskId when provided', async () => {
    const { createTerminalSocket } = await import('./socket-client.js');
    createTerminalSocket({
      serverUrl: 'http://localhost:3000',
      taskId: 'task-1',
      terminalId: 'term-1',
      terminalName: 'Test Terminal',
    });

    const options = mockIo.mock.calls[0][1] as Record<string, unknown>;
    const authFn = options.auth as (cb: (data: object) => void) => void;
    const cb = vi.fn();
    mockGetAccessToken.mockResolvedValue('token-123');
    await authFn(cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      terminalId: 'term-1',
      terminalName: 'Test Terminal',
      terminalHostname: 'test-host',
      token: 'Bearer token-123',
    }));
  });

  it('auth callback omits taskId when not provided', async () => {
    const { createTerminalSocket } = await import('./socket-client.js');
    createTerminalSocket({
      serverUrl: 'http://localhost:3000',
      terminalId: 'term-1',
      terminalName: 'Test Terminal',
    });

    const options = mockIo.mock.calls[0][1] as Record<string, unknown>;
    const authFn = options.auth as (cb: (data: object) => void) => void;
    const cb = vi.fn();
    mockGetAccessToken.mockResolvedValue('token-123');
    await authFn(cb);
    expect(cb).toHaveBeenCalledWith(expect.not.objectContaining({ taskId: expect.anything() }));
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({
      terminalId: 'term-1',
    }));
  });

  it('auth callback omits token when not available', async () => {
    const { createTerminalSocket } = await import('./socket-client.js');
    createTerminalSocket({
      serverUrl: 'http://localhost:3000',
      terminalId: 'term-1',
      terminalName: 'Test Terminal',
    });

    const options = mockIo.mock.calls[0][1] as Record<string, unknown>;
    const authFn = options.auth as (cb: (data: object) => void) => void;
    const cb = vi.fn();
    mockGetAccessToken.mockResolvedValue(undefined);
    await authFn(cb);
    expect(cb).toHaveBeenCalledWith(expect.not.objectContaining({ token: expect.anything() }));
  });

  it('returns socket from io()', async () => {
    const { createTerminalSocket } = await import('./socket-client.js');
    const socket = createTerminalSocket({
      serverUrl: 'http://localhost:3000',
      terminalId: 'term-1',
      terminalName: 'Test Terminal',
    });
    expect(socket).toEqual({ id: 'socket-123' });
  });
});
