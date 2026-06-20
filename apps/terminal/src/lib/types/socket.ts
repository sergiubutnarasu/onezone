import type { Socket } from "socket.io-client";

export interface TerminalSocketOptions {
  serverUrl: string;
  taskId?: string;
  terminalId: string;
  terminalName: string;
}

export interface TaskSocketCallbacks {
  onConnect: (roomId: string) => void;
  onMessage: (event: string, payload: unknown) => void;
  onConnectError: (roomId: string, err: Error) => void;
  onDisconnect: (roomId: string, reason: string) => void;
}

export interface TaskSocketConnection {
  socket: Socket;
  cleanup: () => void;
  isClosed: () => boolean;
}
