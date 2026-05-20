'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE as SERVER_URL } from '../lib/http-client';
import { attachSocketAuthRefresh } from '../lib/socket-auth';

export function useSocketConnection(taskId: string): {
  socket: Socket | null;
  isConnected: boolean;
} {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: { taskId, role: 'user' },
      withCredentials: true,
    });

    socketRef.current = socket;

    attachSocketAuthRefresh(socket);

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [taskId]);

  return { socket: socketRef.current, isConnected };
}
