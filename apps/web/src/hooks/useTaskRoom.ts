"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { EventCommands } from "@onezone/shared";
import { reducer, initialState } from "./useTaskRoom.reducer";
import type { RoomMessage, ConnectedTerminal } from "./useTaskRoom.types";

export type { RoomMessage, ConnectedTerminal };

function useReducerState<T>(initial: T): [T, (value: T) => void] {
  const [val, dispatch] = useReducer((_: T, v: T) => v, initial);
  return [val, dispatch];
}

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5026";

export function useTaskRoom(
  taskId: string,
  options?: { onTaskDeleted?: () => void },
) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isConnected, setIsConnected] = useReducerState(false);
  const socketRef = useRef<Socket | null>(null);
  const onTaskDeletedRef = useRef(options?.onTaskDeleted);
  const qc = useQueryClient();

  useEffect(() => {
    onTaskDeletedRef.current = options?.onTaskDeleted;
  });

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: { taskId, role: "user" },
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on(EventCommands.TaskDeleted, () => {
      socket.disconnect();
      onTaskDeletedRef.current?.();
    });

    socket.on(EventCommands.TaskColumnUpdated, () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
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
      socket.disconnect();
    };
  }, [taskId, setIsConnected, qc]);

  const sendMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      if (!socket || !isConnected) return;
      socket.emit("chat:message", {
        roomId: `task:${taskId}`,
        content,
      });
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
    prependMessages,
  };
}
