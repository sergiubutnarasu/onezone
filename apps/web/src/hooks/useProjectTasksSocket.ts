'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { EventCommands } from '@onezone/shared';
import { API_BASE as SERVER_URL } from '../lib/http-client';
import { attachSocketAuthRefresh } from '../lib/socket-auth';

export function useProjectTasksSocket(projectId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: { projectId, role: 'user' },
      withCredentials: true,
    });

    attachSocketAuthRefresh(socket);

    socket.on(EventCommands.TaskColumnUpdated, () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    });

    socket.on(EventCommands.ProjectCostUpdated, (data: { inputTokens: number; outputTokens: number; costUsd: number }) => {
      qc.setQueryData(['project-cost-stats', projectId], data);
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, qc]);
}
