'use client';

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { ConnectedTerminal } from './useTaskRoom';

export function useConnectedTerminals(socket: Socket | null): ConnectedTerminal[] {
  const [terminals, setTerminals] = useState<Map<string, ConnectedTerminal>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const onConnected = (info: ConnectedTerminal & { ts: number }) => {
      setTerminals((prev) => {
        const next = new Map(prev);
        next.set(info.terminalId, {
          terminalId: info.terminalId,
          terminalName: info.terminalName,
          taskId: info.taskId,
        });
        return next;
      });
    };

    const onDisconnected = (info: { terminalId: string }) => {
      setTerminals((prev) => {
        const next = new Map(prev);
        next.delete(info.terminalId);
        return next;
      });
    };

    socket.on('terminal:connected', onConnected);
    socket.on('terminal:disconnected', onDisconnected);

    return () => {
      socket.off('terminal:connected', onConnected);
      socket.off('terminal:disconnected', onDisconnected);
    };
  }, [socket]);

  return Array.from(terminals.values());
}
