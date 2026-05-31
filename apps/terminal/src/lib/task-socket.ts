// apps/terminal/src/lib/task-socket.ts

import { EventCommands, HEARTBEAT_INTERVAL_MS, createTaskRoomId } from '@onezone/shared';
import { Socket } from 'socket.io-client';
import { IO_SERVER_DISCONNECT } from './constants.js';
import { createTerminalSocket } from './socket-client.js';
import { refreshAccessToken } from './config.js';

export interface TaskSocketCallbacks {
  onConnect: (roomId: string) => void;
  onMessage: (event: string, payload: unknown) => void;
  onConnectError: (roomId: string, err: Error) => void;
  onDisconnect: (roomId: string, reason: string) => void;
}

export interface TaskSocketConnection {
  socket: Socket;
  cleanup: () => void;
}

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
): { isUnauthorizedPending: () => boolean } {
  let unauthorizedPending = false;

  socket.on('error', (err: { message?: string }) => {
    if (err?.message !== 'Unauthorized') return;

    unauthorizedPending = true;
    refreshAccessToken(serverUrl)
      .then((success) => {
        unauthorizedPending = false;
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
        callbacks.onDisconnect(roomId, IO_SERVER_DISCONNECT);
      });
  });

  return { isUnauthorizedPending: () => unauthorizedPending };
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

  const { isUnauthorizedPending } = attachUnauthorizedRefresh(socket, serverUrl, roomId, callbacks);

  socket.on('connect', () => {
    heartbeatTimer = setInterval(() => {
      socket.emit(EventCommands.TerminalHeartbeat);
    }, HEARTBEAT_INTERVAL_MS);
    callbacks.onConnect(roomId);
  });

  // Forward all relevant events to the callback
  const forwardedEvents = [
    EventCommands.ChatMessage,
    EventCommands.AssignTask,
    EventCommands.TaskDeleted,
    EventCommands.TaskColumnUpdated,
    EventCommands.TerminalCommandStop,
  ] as const;

  for (const event of forwardedEvents) {
    socket.on(event, (payload: unknown) => callbacks.onMessage(event, payload));
  }

  socket.on('connect_error', (err) => {
    clearInterval(heartbeatTimer);
    callbacks.onConnectError(roomId, err);
  });

  socket.on('disconnect', (reason) => {
    clearInterval(heartbeatTimer);
    // Suppress IO_SERVER_DISCONNECT while a token refresh is in flight.
    // The error handler will call onDisconnect if the refresh fails, or
    // socket.connect() if it succeeds.
    if (reason === IO_SERVER_DISCONNECT && isUnauthorizedPending()) return;
    callbacks.onDisconnect(roomId, reason);
  });

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    socket.disconnect();
  };

  return { socket, cleanup };
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

  const { isUnauthorizedPending } = attachUnauthorizedRefresh(socket, serverUrl, 'lobby', callbacks);

  socket.on('connect', () => {
    heartbeatTimer = setInterval(() => {
      socket.emit(EventCommands.TerminalHeartbeat);
    }, HEARTBEAT_INTERVAL_MS);
    callbacks.onConnect('lobby');
  });

  socket.on(EventCommands.AssignTask, (payload: unknown) =>
    callbacks.onMessage(EventCommands.AssignTask, payload),
  );

  socket.on('connect_error', (err) => {
    clearInterval(heartbeatTimer);
    callbacks.onConnectError('lobby', err);
  });

  socket.on('disconnect', (reason) => {
    clearInterval(heartbeatTimer);
    if (reason === IO_SERVER_DISCONNECT && isUnauthorizedPending()) return;
    callbacks.onDisconnect('lobby', reason);
  });

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    socket.disconnect();
  };

  return { socket, cleanup };
}
