'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { EventCommands } from '@onezone/shared';
import { API_BASE as SERVER_URL } from '../lib/http-client';
import { attachSocketAuthRefresh } from '../lib/socket-auth';

/**
 * Connects a global socket (no task/project room) to receive server-wide events
 * like new notifications.
 */
export function useGlobalSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: { role: 'user' },
      withCredentials: true,
    });

    attachSocketAuthRefresh(socket);

    socket.on(EventCommands.NotificationCreated, () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [qc]);
}
