'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { io } from 'socket.io-client';
import { EventCommands, type Task, type Terminal } from '@onezone/shared';
import { API_BASE as SERVER_URL } from '../lib/http-client';
import { useAuth } from '../lib/auth-context';
import { attachSocketAuthRefresh } from '../lib/socket-auth';

function updateTerminalConnectionState(
  qc: ReturnType<typeof useQueryClient>,
  terminalId: string,
  isConnected: boolean,
) {
  qc.setQueryData<Terminal[]>(['terminals'], (terminals) =>
    terminals?.map((terminal) =>
      terminal.id === terminalId ? { ...terminal, isConnected } : terminal,
    ),
  );

  qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (tasks) =>
    tasks?.map((task) =>
      task.terminal?.id === terminalId
        ? { ...task, terminal: { ...task.terminal, isConnected } }
        : task,
    ),
  );

  qc.setQueriesData<Task>({ queryKey: ['task'] }, (task) =>
    task?.terminal?.id === terminalId
      ? { ...task, terminal: { ...task.terminal, isConnected } }
      : task,
  );
}

/**
 * Connects a global socket (no task/project room) to receive server-wide events
 * like new notifications.
 */
export function useGlobalSocket() {
  const qc = useQueryClient();
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isPublicRoute =
    pathname === '/auth/login' || pathname === '/auth/register';

  useEffect(() => {
    // On public auth routes (or before we know the user) the server would
    // reject the handshake as Unauthorized and socket-auth.ts would reload
    // /auth/login — looping forever. Skip the connection until we have a
    // session on a non-public route.
    if (isLoading || !user || isPublicRoute) return;

    const socket = io(`${SERVER_URL}/chat`, {
      auth: { role: 'user' },
      withCredentials: true,
    });

    const detachSocketAuthRefresh = attachSocketAuthRefresh(socket);

    socket.on(EventCommands.NotificationCreated, () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    });

    socket.on(
      EventCommands.TerminalConnected,
      (payload: { terminalId: string }) => {
        updateTerminalConnectionState(qc, payload.terminalId, true);
      },
    );

    socket.on(
      EventCommands.TerminalDisconnected,
      (payload: { terminalId: string }) => {
        updateTerminalConnectionState(qc, payload.terminalId, false);
      },
    );

    return () => {
      detachSocketAuthRefresh();
      socket.disconnect();
    };
  }, [qc, user, isLoading, isPublicRoute]);
}
