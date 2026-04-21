// apps/agent/src/lib/task-socket.ts

import { EventCommands, HEARTBEAT_INTERVAL_MS, createTaskRoomId } from '@onezone/shared';
import { Socket } from 'socket.io-client';
import { createAgentSocket } from './socket-client.js';

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
 * Creates a socket connection to a task room, setting up heartbeat and
 * lifecycle handlers. Returns the socket and a cleanup function.
 *
 * The caller receives raw socket events via callbacks, allowing the
 * command layer to remain the single source of truth for business logic.
 */
export function createTaskSocket(
  serverUrl: string,
  taskId: string,
  agentId: string,
  agentName: string,
  callbacks: TaskSocketCallbacks,
): TaskSocketConnection {
  const roomId = createTaskRoomId(taskId);

  const socket = createAgentSocket({ serverUrl, taskId, agentId, agentName });

  let heartbeatTimer: NodeJS.Timeout | undefined;

  socket.on('connect', () => {
    heartbeatTimer = setInterval(() => {
      socket.emit(EventCommands.AgentHeartbeat);
    }, HEARTBEAT_INTERVAL_MS);
    callbacks.onConnect(roomId);
  });

  // Forward all relevant events to the callback
  const forwardedEvents = [
    EventCommands.ChatMessage,
    EventCommands.AssignTask,
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
  agentId: string,
  agentName: string,
  callbacks: TaskSocketCallbacks,
): TaskSocketConnection {
  const socket = createAgentSocket({ serverUrl, agentId, agentName });

  let heartbeatTimer: NodeJS.Timeout | undefined;

  socket.on('connect', () => {
    heartbeatTimer = setInterval(() => {
      socket.emit(EventCommands.AgentHeartbeat);
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
    callbacks.onDisconnect('lobby', reason);
  });

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    socket.disconnect();
  };

  return { socket, cleanup };
}
