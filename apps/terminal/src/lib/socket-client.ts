import {
  ClientToServerEvents,
  MessageRole,
  ServerToClientEvents,
} from "@onezone/shared";
import { hostname } from "node:os";
import { io, Socket } from "socket.io-client";

export interface TerminalSocketOptions {
  serverUrl: string;
  taskId?: string;
  terminalId: string;
  terminalName: string;
}

export function createTerminalSocket(
  options: TerminalSocketOptions,
): Socket<ServerToClientEvents, ClientToServerEvents> {
  const { serverUrl, taskId, terminalId, terminalName } = options;

  const socket = io(`${serverUrl}/chat`, {
    auth: {
      ...(taskId ? { taskId } : {}),
      role: MessageRole.Terminal,
      terminalId,
      terminalName,
      terminalHostname: hostname(),
    },
    reconnection: true,
  });

  return socket;
}
