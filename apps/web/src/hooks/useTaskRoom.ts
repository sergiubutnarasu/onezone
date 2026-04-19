'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RoomMessage {
  id?: string;
  roomId: string;
  role: 'user' | 'agent' | 'system';
  agentId?: string | null;
  agentName?: string | null;
  jobId?: string | null;
  command?: string | null;
  stream?: 'stdout' | 'stderr' | null;
  exitCode?: number | null;
  content: string;
  ts: number;
}

export interface ConnectedAgent {
  agentId: string;
  agentName: string;
  taskId: string;
}

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5026';

export function useTaskRoom(taskId: string) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [connectedAgents, setConnectedAgents] = useState<Map<string, ConnectedAgent>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: {
        taskId,
        role: 'user',
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('chat:message', (msg: RoomMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('output:line', (msg: RoomMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on(
      'agent:command:start',
      (payload: { agentId: string; agentName: string; jobId: string; command: string; ts: number }) => {
        setMessages((prev) => [
          ...prev,
          {
            roomId: `task:${taskId}`,
            role: 'system',
            agentId: payload.agentId,
            agentName: payload.agentName,
            jobId: payload.jobId,
            command: payload.command,
            content: `[${payload.agentName}] started: ${payload.command}`,
            ts: payload.ts,
          },
        ]);
      },
    );

    socket.on(
      'agent:command:exit',
      (payload: { agentId: string; jobId: string; command: string; exitCode: number; ts: number }) => {
        setMessages((prev) => [
          ...prev,
          {
            roomId: `task:${taskId}`,
            role: 'system',
            agentId: payload.agentId,
            jobId: payload.jobId,
            command: payload.command,
            exitCode: payload.exitCode,
            content: payload.command,
            ts: payload.ts,
          },
        ]);
      },
    );

    socket.on('agent:connected', (info: ConnectedAgent & { ts: number }) => {
      setConnectedAgents((prev) => {
        const next = new Map(prev);
        next.set(info.agentId, { agentId: info.agentId, agentName: info.agentName, taskId: info.taskId });
        return next;
      });
      setMessages((prev) => [
        ...prev,
        {
          roomId: `task:${taskId}`,
          role: 'system',
          agentId: info.agentId,
          agentName: info.agentName,
          content: `${info.agentName} connected`,
          ts: info.ts,
        },
      ]);
    });

    socket.on('agent:disconnected', (info: ConnectedAgent & { ts: number }) => {
      setConnectedAgents((prev) => {
        const next = new Map(prev);
        next.delete(info.agentId);
        return next;
      });
      setMessages((prev) => [
        ...prev,
        {
          roomId: `task:${taskId}`,
          role: 'system',
          agentId: info.agentId,
          agentName: info.agentName,
          content: `${info.agentName} disconnected`,
          ts: info.ts,
        },
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, [taskId]);

  const sendMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      if (!socket || !isConnected) return;
      socket.emit('chat:message', {
        roomId: `task:${taskId}`,
        content,
      });
    },
    [taskId, isConnected],
  );

  const prependMessages = useCallback((msgs: RoomMessage[]) => {
    setMessages(msgs);
  }, []);

  return {
    messages,
    connectedAgents: Array.from(connectedAgents.values()),
    isConnected,
    sendMessage,
    prependMessages,
  };
}
