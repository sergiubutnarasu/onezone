// apps/terminal/src/lib/task-socket.ts

import { EventCommands, HEARTBEAT_INTERVAL_MS, createTaskRoomId } from '@onezone/shared';
import { Socket } from 'socket.io-client';
import { IO_SERVER_DISCONNECT } from './constants.js';
import { createTerminalSocket } from './socket-client.js';
import { refreshAccessToken } from './config.js';
import type { TaskSocketCallbacks, TaskSocketConnection } from './types/index.js';

/**
 * Attaches an "Unauthorized" error handler to a socket.
 *
 * When the server rejects an event due to an expired token it emits
 * `error: { message: 'Unauthorized' }` and then calls `socket.disconnect()`,
 * which delivers `disconnect: IO_SERVER_DISCONNECT` to the client.
 *
 * Instead of letting that disconnect bubble up as a fatal event, we:
 *   1. Refresh the access token (deduplicated in config.ts).
 *   2. If refresh succeeds  → call `socket.connect()` to reconnect with the
 *      new token.  The normal `onConnect` callback fires and the running
 *      command is left untouched.
 *   3. If refresh fails → call `onDisconnect` so the caller can tear down
 *      cleanly.
 *
 * Returns a flag getter so the disconnect handler can suppress the "io server
 * disconnect" event while a refresh is in flight.
 */
function attachUnauthorizedRefresh(
  socket: Socket,
  serverUrl: string,
  roomId: string,
  callbacks: Pick<TaskSocketCallbacks, 'onDisconnect'>,
  isClosed: () => boolean,
): {
  isUnauthorizedPending: () => boolean;
  refreshIfUnauthorized: (err: { message?: string }) => boolean;
  cleanup: () => void;
} {
  let unauthorizedPending = false;

  const refreshAndReconnect = () => {
    if (unauthorizedPending) return;

    unauthorizedPending = true;
    refreshAccessToken(serverUrl)
      .then((success) => {
        unauthorizedPending = false;
        if (isClosed()) return;
        if (success) {
          // Reconnect with the freshly stored token.
          socket.connect();
        } else {
          // Token refresh failed — propagate as a normal disconnect.
          callbacks.onDisconnect(roomId, IO_SERVER_DISCONNECT);
        }
      })
      .catch(() => {
        unauthorizedPending = false;
        if (isClosed()) return;
        callbacks.onDisconnect(roomId, IO_SERVER_DISCONNECT);
      });
  };

  const refreshIfUnauthorized = (err: { message?: string }): boolean => {
    if (isClosed()) return false;
    if (err?.message !== 'Unauthorized') return false;
    refreshAndReconnect();
    return true;
  };

  socket.on('error', refreshIfUnauthorized);

  return {
    isUnauthorizedPending: () => unauthorizedPending,
    refreshIfUnauthorized,
    cleanup: () => socket.off('error', refreshIfUnauthorized),
  };
}

/**
 * Creates a socket connection to a task room, setting up heartbeat and
 * lifecycle handlers. Returns the socket and a cleanup function.
 */
export function createTaskSocket(
  serverUrl: string,
  taskId: string,
  terminalId: string,
  terminalName: string,
  callbacks: TaskSocketCallbacks,
): TaskSocketConnection {
  const roomId = createTaskRoomId(taskId);

  const socket = createTerminalSocket({ serverUrl, taskId, terminalId, terminalName });

  let heartbeatTimer: NodeJS.Timeout | undefined;
  let closed = false;

  const { isUnauthorizedPending, refreshIfUnauthorized, cleanup: cleanupUnauthorizedRefresh } = attachUnauthorizedRefresh(
    socket,
    serverUrl,
    roomId,
    callbacks,
    () => closed,
  );

  socket.on('connect', () => {
    if (closed) {
      socket.disconnect();
      return;
    }
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      socket.emit(EventCommands.TerminalHeartbeat);
    }, HEARTBEAT_INTERVAL_MS);
    callbacks.onConnect(roomId);
  });

  // Forward all relevant events to the callback
  const forwardedEvents = [
    EventCommands.TerminalCommandRun,
    EventCommands.AssignTask,
    EventCommands.TaskDeleted,
    EventCommands.TaskColumnUpdated,
    EventCommands.TerminalCommandStop,
  ] as const;

  for (const event of forwardedEvents) {
    socket.on(event, (payload: unknown) => callbacks.onMessage(event, payload));
  }

  socket.on('connect_error', (err) => {
    if (closed) return;
    clearInterval(heartbeatTimer);
    if (refreshIfUnauthorized(err)) return;
    callbacks.onConnectError(roomId, err);
  });

  socket.on('disconnect', (reason) => {
    if (closed) return;
    clearInterval(heartbeatTimer);
    // Suppress IO_SERVER_DISCONNECT while a token refresh is in flight.
    // The error handler will call onDisconnect if the refresh fails, or
    // socket.connect() if it succeeds.
    if (reason === IO_SERVER_DISCONNECT && isUnauthorizedPending()) return;
    callbacks.onDisconnect(roomId, reason);
  });

  const cleanup = () => {
    closed = true;
    clearInterval(heartbeatTimer);
    cleanupUnauthorizedRefresh();
    socket.disconnect();
  };

  return { socket, cleanup, isClosed: () => closed };
}

/**
 * Creates a lobby socket connection (no taskId), setting up heartbeat and
 * lifecycle handlers.
 */
export function createLobbySocket(
  serverUrl: string,
  terminalId: string,
  terminalName: string,
  callbacks: TaskSocketCallbacks,
): TaskSocketConnection {
  const socket = createTerminalSocket({ serverUrl, terminalId, terminalName });

  let heartbeatTimer: NodeJS.Timeout | undefined;
  let closed = false;

  const { isUnauthorizedPending, refreshIfUnauthorized, cleanup: cleanupUnauthorizedRefresh } = attachUnauthorizedRefresh(
    socket,
    serverUrl,
    'lobby',
    callbacks,
    () => closed,
  );

  socket.on('connect', () => {
    if (closed) {
      socket.disconnect();
      return;
    }
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      socket.emit(EventCommands.TerminalHeartbeat);
    }, HEARTBEAT_INTERVAL_MS);
    callbacks.onConnect('lobby');
  });

  socket.on(EventCommands.AssignTask, (payload: unknown) =>
    callbacks.onMessage(EventCommands.AssignTask, payload),
  );

  socket.on('connect_error', (err) => {
    if (closed) return;
    clearInterval(heartbeatTimer);
    if (refreshIfUnauthorized(err)) return;
    callbacks.onConnectError('lobby', err);
  });

  socket.on('disconnect', (reason) => {
    if (closed) return;
    clearInterval(heartbeatTimer);
    if (reason === IO_SERVER_DISCONNECT && isUnauthorizedPending()) return;
    callbacks.onDisconnect('lobby', reason);
  });

  const cleanup = () => {
    closed = true;
    clearInterval(heartbeatTimer);
    cleanupUnauthorizedRefresh();
    socket.disconnect();
  };

  return { socket, cleanup, isClosed: () => closed };
}
