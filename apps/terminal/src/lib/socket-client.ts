import {
  ClientToServerEvents,
  MessageRole,
  ServerToClientEvents,
} from "@onezone/shared";
import { hostname } from "node:os";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./config.js";
import type { TerminalSocketOptions } from "./types/index.js";

export function createTerminalSocket(
  options: TerminalSocketOptions,
): Socket<ServerToClientEvents, ClientToServerEvents> {
  const { serverUrl, taskId, terminalId, terminalName } = options;

  const socket = io(`${serverUrl}/chat`, {
    auth: async (cb: (data: object) => void) => {
      const token = await getAccessToken();
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
