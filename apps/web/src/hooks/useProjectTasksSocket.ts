'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { EventCommands } from '@onezone/shared';

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5026';

export function useProjectTasksSocket(projectId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = io(`${SERVER_URL}/chat`, {
      auth: { projectId, role: 'user' },
    });

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
