'use client';

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { ConnectedAgent } from './useTaskRoom';

export function useConnectedAgents(socket: Socket | null): ConnectedAgent[] {
  const [agents, setAgents] = useState<Map<string, ConnectedAgent>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const onConnected = (info: ConnectedAgent & { ts: number }) => {
      setAgents((prev) => {
        const next = new Map(prev);
        next.set(info.agentId, {
          agentId: info.agentId,
          agentName: info.agentName,
          taskId: info.taskId,
        });
        return next;
      });
    };

    const onDisconnected = (info: { agentId: string }) => {
      setAgents((prev) => {
        const next = new Map(prev);
        next.delete(info.agentId);
        return next;
      });
    };

    socket.on('agent:connected', onConnected);
    socket.on('agent:disconnected', onDisconnected);

    return () => {
      socket.off('agent:connected', onConnected);
      socket.off('agent:disconnected', onDisconnected);
    };
  }, [socket]);

  return Array.from(agents.values());
}
