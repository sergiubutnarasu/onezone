'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTaskStatus } from '@/lib/api';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { TASK_STATUS_COLUMNS, TaskStatus, type Task } from '@onezone/shared';

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
}

function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups = {} as Record<TaskStatus, Task[]>;
  for (const status of TASK_STATUS_COLUMNS) {
    groups[status] = [];
  }
  for (const task of tasks) {
    groups[task.status]?.push(task);
  }
  return groups;
}

export function KanbanBoard({ tasks: initialTasks, projectId }: KanbanBoardProps) {
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Keep local state in sync when the server data changes
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTaskStatus(taskId, status),
    onError: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const columns = groupByStatus(tasks);

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const task = active.data.current?.task as Task | undefined;
    setActiveTask(task ?? null);
  }, []);

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      setTasks((prev) => {
        const activeTask = prev.find((t) => t.id === activeId);
        if (!activeTask) return prev;

        const targetStatus = TASK_STATUS_COLUMNS.includes(overId as TaskStatus)
          ? (overId as TaskStatus)
          : prev.find((t) => t.id === overId)?.status;

        if (!targetStatus || activeTask.status === targetStatus) return prev;

        return prev.map((t) => (t.id === activeId ? { ...t, status: targetStatus } : t));
      });
    },
    [],
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveTask(null);
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      setTasks((prev) => {
        const activeTask = prev.find((t) => t.id === activeId);
        if (!activeTask) return prev;

        const targetStatus = TASK_STATUS_COLUMNS.includes(overId as TaskStatus)
          ? (overId as TaskStatus)
          : prev.find((t) => t.id === overId)?.status;

        if (!targetStatus) return prev;

        if (activeTask.status !== targetStatus) {
          statusMutation.mutate({ taskId: activeId, status: targetStatus });
        }

        if (overId !== activeId && !TASK_STATUS_COLUMNS.includes(overId as TaskStatus)) {
          const oldIndex = prev.findIndex((t) => t.id === activeId);
          const newIndex = prev.findIndex((t) => t.id === overId);
          return arrayMove(prev, oldIndex, newIndex);
        }

        return prev;
      });
    },
    [statusMutation],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_STATUS_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            projectId={projectId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && <KanbanCard task={activeTask} projectId={projectId} />}
      </DragOverlay>
    </DndContext>
  );
}
