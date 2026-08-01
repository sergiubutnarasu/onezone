import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventCommands } from '@onezone/shared';
import { IO_SERVER_DISCONNECT } from './constants.js';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

const mockCreateTerminalSocket = vi.fn();
const mockRefreshAccessToken = vi.fn();

vi.doMock('./socket-client.js', () => ({
  createTerminalSocket: mockCreateTerminalSocket,
}));

vi.doMock('./config.js', () => ({
  refreshAccessToken: mockRefreshAccessToken,
}));

describe('task-socket', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCreateTerminalSocket.mockReturnValue(mockSocket);
    mockRefreshAccessToken.mockReset();
  });

  describe('createTaskSocket', () => {
    it('creates socket via createTerminalSocket', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);
      expect(mockCreateTerminalSocket).toHaveBeenCalledWith({
        serverUrl: 'http://localhost:3000',
        taskId: 'task-1',
        terminalId: 'term-1',
        terminalName: 'Test',
      });
    });

    it('registers connect handler that starts heartbeat', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const connectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect')?.[1] as () => void;
      expect(connectHandler).toBeDefined();

      vi.useFakeTimers();
      connectHandler();
      expect(callbacks.onConnect).toHaveBeenCalled();
      vi.advanceTimersByTime(30001);
      expect(mockSocket.emit).toHaveBeenCalledWith(EventCommands.TerminalHeartbeat);
      vi.useRealTimers();
    });

    it('disconnects when connect fires after cleanup (closed)', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);
      cleanup();
      const connectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect')?.[1] as () => void;
      connectHandler();
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(2);
    });

    it('returns early on connect_error when closed', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);
      cleanup();
      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: { message?: string }) => void;
      errorHandler({ message: 'Unauthorized' });
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
      expect(callbacks.onConnectError).not.toHaveBeenCalled();
    });

    it('registers forwarded event handlers', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const expectedEvents = [
        EventCommands.TerminalCommandRun,
        EventCommands.AssignTask,
        EventCommands.TaskDeleted,
        EventCommands.TaskColumnUpdated,
        EventCommands.TerminalCommandStop,
      ];

      for (const event of expectedEvents) {
        const handler = mockSocket.on.mock.calls
          .find((call: unknown[]) => call[0] === event)?.[1] as (payload: unknown) => void;
        expect(handler).toBeDefined();
        handler({ data: 'test' });
        expect(callbacks.onMessage).toHaveBeenCalledWith(event, { data: 'test' });
      }
    });

    it('handles connect_error with unauthorized refresh', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      mockRefreshAccessToken.mockResolvedValue(true);
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: { message?: string }) => void;
      expect(errorHandler).toBeDefined();

      errorHandler({ message: 'Unauthorized' });
      expect(mockRefreshAccessToken).toHaveBeenCalledWith('http://localhost:3000');
    });

    it('calls onConnectError for non-unauthorized errors', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: Error) => void;
      errorHandler(new Error('network down'));
      expect(callbacks.onConnectError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ message: 'network down' }),
      );
    });

    it('suppresses disconnect during unauthorized refresh', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      let refreshResolve: (val: boolean) => void;
      mockRefreshAccessToken.mockReturnValue(new Promise((resolve) => { refreshResolve = resolve; }));
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: { message?: string }) => void;
      const disconnectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'disconnect')?.[1] as (reason: string) => void;

      errorHandler({ message: 'Unauthorized' });
      // During refresh, disconnect should be suppressed
      disconnectHandler(IO_SERVER_DISCONNECT);
      expect(callbacks.onDisconnect).not.toHaveBeenCalled();

      refreshResolve(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('does not re-trigger refresh when already pending', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      let refreshResolve: (val: boolean) => void;
      mockRefreshAccessToken.mockReturnValue(new Promise((resolve) => { refreshResolve = resolve; }));
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'error')?.[1] as (err: { message?: string }) => void;

      errorHandler({ message: 'Unauthorized' });
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);

      // Trigger again while pending — should dedupe
      errorHandler({ message: 'Unauthorized' });
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);

      refreshResolve(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('ignores disconnect when task socket is closed', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);
      cleanup();

      const disconnectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'disconnect')?.[1] as (reason: string) => void;
      disconnectHandler('transport close');
      expect(callbacks.onDisconnect).not.toHaveBeenCalled();
    });

    it('ignores lobby connect_error when closed', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);
      cleanup();

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: Error) => void;
      errorHandler(new Error('network down'));
      expect(callbacks.onConnectError).not.toHaveBeenCalled();
    });

    it('ignores lobby disconnect when closed', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);
      cleanup();

      const disconnectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'disconnect')?.[1] as (reason: string) => void;
      disconnectHandler('transport close');
      expect(callbacks.onDisconnect).not.toHaveBeenCalled();
    });

    it('calls onDisconnect when refresh returns false', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      mockRefreshAccessToken.mockResolvedValue(false);
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'error')?.[1] as (err: { message?: string }) => void;
      errorHandler({ message: 'Unauthorized' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callbacks.onDisconnect).toHaveBeenCalledWith(expect.any(String), IO_SERVER_DISCONNECT);
    });

    it('calls onDisconnect when refresh rejects', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      mockRefreshAccessToken.mockRejectedValue(new Error('network'));
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'error')?.[1] as (err: { message?: string }) => void;
      errorHandler({ message: 'Unauthorized' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callbacks.onDisconnect).toHaveBeenCalledWith(expect.any(String), IO_SERVER_DISCONNECT);
    });

    it('disconnects when connect fires after cleanup (closed)', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);
      cleanup();
      const connectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect')?.[1] as () => void;
      connectHandler();
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(2);
      expect(callbacks.onConnect).not.toHaveBeenCalled();
    });

    it('returns early on connect_error when closed', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);
      cleanup();
      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: { message?: string }) => void;
      errorHandler({ message: 'Unauthorized' });
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
      expect(callbacks.onConnectError).not.toHaveBeenCalled();
    });

    it('calls onDisconnect for non-io-server-disconnect reasons', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);

      const disconnectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'disconnect')?.[1] as (reason: string) => void;
      disconnectHandler('transport close');
      expect(callbacks.onDisconnect).toHaveBeenCalledWith(expect.any(String), 'transport close');
    });

    it('cleanup disconnects socket and stops heartbeat', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);
      cleanup();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(mockSocket.off).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('createLobbySocket', () => {
    it('creates lobby socket without taskId', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);
      expect(mockCreateTerminalSocket).toHaveBeenCalledWith({
        serverUrl: 'http://localhost:3000',
        terminalId: 'term-1',
        terminalName: 'Test',
      });
    });

    it('registers lobby-specific event handlers', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);

      for (const event of [EventCommands.AssignTask, EventCommands.ProjectBuilderCommand, EventCommands.ProjectBuilderCommandStop]) {
        const handler = mockSocket.on.mock.calls
          .find((call: unknown[]) => call[0] === event)?.[1] as (payload: unknown) => void;
        expect(handler).toBeDefined();
        handler({ test: true });
        expect(callbacks.onMessage).toHaveBeenCalledWith(event, { test: true });
      }
    });

    it('cleanup closes lobby socket', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);
      cleanup();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('handles connect_error with unauthorized refresh', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      mockRefreshAccessToken.mockResolvedValue(true);
      createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: { message?: string }) => void;
      errorHandler({ message: 'Unauthorized' });
      expect(mockRefreshAccessToken).toHaveBeenCalledWith('http://localhost:3000');
      expect(callbacks.onConnectError).not.toHaveBeenCalled();
    });

    it('calls onConnectError for non-unauthorized lobby errors', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: Error) => void;
      errorHandler(new Error('network down'));
      expect(callbacks.onConnectError).toHaveBeenCalledWith('lobby', expect.objectContaining({ message: 'network down' }));
    });

    it('suppresses lobby disconnect during unauthorized refresh', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      let refreshResolve: (val: boolean) => void;
      mockRefreshAccessToken.mockReturnValue(new Promise((resolve) => { refreshResolve = resolve; }));
      createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect_error')?.[1] as (err: { message?: string }) => void;
      const disconnectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'disconnect')?.[1] as (reason: string) => void;

      errorHandler({ message: 'Unauthorized' });
      disconnectHandler(IO_SERVER_DISCONNECT);
      expect(callbacks.onDisconnect).not.toHaveBeenCalled();

      refreshResolve(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('calls onDisconnect for non-io-server-disconnect lobby reasons', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);

      const disconnectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'disconnect')?.[1] as (reason: string) => void;
      disconnectHandler('transport close');
      expect(callbacks.onDisconnect).toHaveBeenCalledWith('lobby', 'transport close');
    });

    it('disconnects lobby when connect fires after cleanup (closed)', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);
      cleanup();
      const connectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect')?.[1] as () => void;
      connectHandler();
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(2);
      expect(callbacks.onConnect).not.toHaveBeenCalled();
    });

    it('starts lobby heartbeat on connect', async () => {
      const { createLobbySocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      createLobbySocket('http://localhost:3000', 'term-1', 'Test', callbacks);

      const connectHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'connect')?.[1] as () => void;
      expect(connectHandler).toBeDefined();

      vi.useFakeTimers();
      connectHandler();
      expect(callbacks.onConnect).toHaveBeenCalledWith('lobby');
      vi.advanceTimersByTime(30001);
      expect(mockSocket.emit).toHaveBeenCalledWith(EventCommands.TerminalHeartbeat);
      vi.useRealTimers();
    });
  });

  describe('error handler when closed', () => {
    it('does not call refreshIfUnauthorized when closed', async () => {
      const { createTaskSocket } = await import('./task-socket.js');
      const callbacks = {
        onConnect: vi.fn(),
        onMessage: vi.fn(),
        onConnectError: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const { cleanup } = createTaskSocket('http://localhost:3000', 'task-1', 'term-1', 'Test', callbacks);
      cleanup();

      const errorHandler = mockSocket.on.mock.calls
        .find((call: unknown[]) => call[0] === 'error')?.[1] as (err: { message?: string }) => void;
      errorHandler({ message: 'Unauthorized' });
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });
  });
});
