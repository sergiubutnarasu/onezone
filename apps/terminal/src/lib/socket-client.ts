import {
  ClientToServerEvents,
  MessageRole,
  ServerToClientEvents,
} from "@onezone/shared";
import { hostname } from "node:os";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./config.js";

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
    auth: (cb: (data: object) => void) => {
      const token = getAccessToken();
      cb({
        ...(taskId ? { taskId } : {}),
        role: MessageRole.Terminal,
        terminalId,
        terminalName,
        terminalHostname: hostname(),
        ...(token ? { token: `Bearer ${token}` } : {}),
      });
    },
    reconnection: true,
  });

  return socket;
}
