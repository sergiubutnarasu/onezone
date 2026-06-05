"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { EventCommands } from "@onezone/shared";
import { reducer, initialState } from "./useTaskRoom.reducer";
import type { RoomMessage, ConnectedTerminal } from "./useTaskRoom.types";
import { API_BASE as SERVER_URL } from "../lib/http-client";
import { attachSocketAuthRefresh } from "../lib/socket-auth";

export type { RoomMessage, ConnectedTerminal };

function useReducerState<T>(initial: T): [T, (value: T) => void] {
  const [val, dispatch] = useReducer((_: T, v: T) => v, initial);
  return [val, dispatch];
}

export function useTaskRoom(
  taskId: string,
  options?: { onTaskDeleted?: () => void; projectId?: string },
) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isConnected, setIsConnected] = useReducerState(false);
  const socketRef = useRef<Socket | null>(null);
  const onTaskDeletedRef = useRef(options?.onTaskDeleted);
  const qc = useQueryClient();
  const projectId = options?.projectId;

  useEffect(() => {
    onTaskDeletedRef.current = options?.onTaskDeleted;
  });

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: { taskId, role: "user" },
      withCredentials: true,
    });

    socketRef.current = socket;

    const detachSocketAuthRefresh = attachSocketAuthRefresh(socket);

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on(EventCommands.TaskDeleted, () => {
      socket.disconnect();
      onTaskDeletedRef.current?.();
    });

    socket.on(EventCommands.TaskColumnUpdated, () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      if (projectId) {
        qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      }
    });

    socket.on("chat:message", (msg: RoomMessage) => {
      dispatch({ type: "APPEND_MESSAGE", message: msg });
    });

    socket.on("output:line", (msg: RoomMessage) => {
      dispatch({ type: "APPEND_MESSAGE", message: msg });
    });

    socket.on(
      "terminal:command:start",
      (payload: {
        terminalId: string;
        terminalName: string;
        jobId: string;
        command: string;
        agentName?: string;
        model?: string;
        ts: number;
      }) => {
        dispatch({ type: "COMMAND_START", payload, taskId });
      },
    );

    socket.on(
      "terminal:command:exit",
      (payload: {
        terminalId: string;
        jobId: string;
        command: string;
        exitCode: number;
        inputTokens?: number;
        outputTokens?: number;
        totalCostUsd?: number;
        ts: number;
      }) => {
        dispatch({ type: "COMMAND_EXIT", payload, taskId });
        qc.invalidateQueries({ queryKey: ["task", taskId] });
      },
    );

    socket.on("terminal:connected", (info: ConnectedTerminal & { ts: number }) => {
      dispatch({ type: "TERMINAL_CONNECTED", info });
    });

    socket.on(
      "terminal:disconnected",
      (info: { terminalId: string; terminalName?: string; ts: number }) => {
        dispatch({ type: "TERMINAL_DISCONNECTED", info });
      },
    );

    return () => {
      detachSocketAuthRefresh();
      socket.disconnect();
    };
  }, [taskId, setIsConnected, qc, projectId]);

  const sendMessage = useCallback(
    (content: string): Promise<boolean> => {
      const socket = socketRef.current;
      if (!socket || !isConnected) return Promise.resolve(false);

      // Wait for the gateway ack before clearing the input, otherwise a brief
      // socket drop can make a typed command disappear without reaching a job.
      return new Promise((resolve) => {
        socket.timeout(10_000).emit(EventCommands.ChatMessage, {
          roomId: `task:${taskId}`,
          content,
        }, (error: Error | null, response?: { status?: "ok" | "error" }) => {
          resolve(!error && response?.status === "ok");
        });
      });
    },
    [taskId, isConnected],
  );

  const stopCommand = useCallback(
    (jobId: string) => {
      const socket = socketRef.current;
      if (!socket || !isConnected) return;
      socket.emit(EventCommands.TerminalCommandStop, { jobId, taskId });
    },
    [taskId, isConnected],
  );

  const pingCommand = useCallback(
    (jobId: string, input: string) => {
      const socket = socketRef.current;
      if (!socket || !isConnected) return;
      socket.emit(EventCommands.TerminalCommandPing, { jobId, taskId, input });
    },
    [taskId, isConnected],
  );

  const prependMessages = useCallback((msgs: RoomMessage[]) => {
    dispatch({ type: "SET_MESSAGES", messages: msgs });
  }, []);

  return {
    messages: state.messages,
    liveMessages: state.liveMessages,
    connectedTerminals: Array.from(state.connectedTerminals.values()),
    isConnected,
    sendMessage,
    stopCommand,
    pingCommand,
    prependMessages,
  };
}
