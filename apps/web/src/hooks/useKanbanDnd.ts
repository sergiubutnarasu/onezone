'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderTasks, type TaskOrderItem } from '@/lib/api';
import { TASK_STATUS_COLUMNS, type Task, type TaskStatus } from '@onezone/shared';

// ---------------------------------------------------------------------------
// Pure helpers (no side-effects, easy to unit-test)
// ---------------------------------------------------------------------------

function resolveTargetStatus(tasks: Task[], overId: string): TaskStatus | undefined {
  if (TASK_STATUS_COLUMNS.includes(overId as TaskStatus)) return overId as TaskStatus;
  return tasks.find((t) => t.id === overId)?.status;
}

function applyStatusChange(tasks: Task[], activeId: string, targetStatus: TaskStatus): Task[] {
  const task = tasks.find((t) => t.id === activeId);
  if (!task || task.status === targetStatus) return tasks;
  return tasks.map((t) => (t.id === activeId ? { ...t, status: targetStatus } : t));
}

function applyReorder(tasks: Task[], activeId: string, overId: string): Task[] {
  const oldIndex = tasks.findIndex((t) => t.id === activeId);
  const newIndex = tasks.findIndex((t) => t.id === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return tasks;
  return arrayMove(tasks, oldIndex, newIndex);
}

function toReorderPayload(tasks: Task[]): TaskOrderItem[] {
  const counters = new Map<TaskStatus, number>();
  return tasks.map((t) => {
    const order = counters.get(t.status) ?? 0;
    counters.set(t.status, order + 1);
    return { id: t.id, status: t.status, order };
  });
}

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups = {} as Record<TaskStatus, Task[]>;
  for (const status of TASK_STATUS_COLUMNS) groups[status] = [];
  for (const task of tasks) groups[task.status]?.push(task);
  return groups;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface KanbanDnd {
  tasks: Task[];
  activeTask: Task | null;
  columns: Record<TaskStatus, Task[]>;
  sensors: ReturnType<typeof useSensors>;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export function useKanbanDnd(projectId: string, initialTasks: Task[]): KanbanDnd {
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Refs let drag handlers always read the latest tasks without stale closures
  // and without adding `tasks` to useCallback dependency arrays.
  const tasksRef = useRef<Task[]>(initialTasks);
  const originStatusRef = useRef<TaskStatus | null>(null);
  const preDropSnapshotRef = useRef<Task[]>(initialTasks);

  const syncTasks = useCallback((next: Task[]) => {
    tasksRef.current = next;
    setTasks(next);
  }, []);

  // Sync local state when the server data changes (e.g. another user, refetch).
  useEffect(() => {
    syncTasks(initialTasks);
    preDropSnapshotRef.current = initialTasks;
  }, [initialTasks, syncTasks]);

  const { mutate: persistOrder } = useMutation({
    mutationFn: (items: TaskOrderItem[]) => reorderTasks(projectId, items),
    onSuccess: (updated: Task[]) => {
      syncTasks(updated);
      qc.setQueryData(['tasks', projectId], updated);
    },
    onError: () => {
      // Roll back to the state before the drag started.
      syncTasks(preDropSnapshotRef.current);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const task = (active.data.current?.task as Task) ?? null;
    setActiveTask(task);
    originStatusRef.current = task?.status ?? null;
    preDropSnapshotRef.current = tasksRef.current;
  }, []);

  const onDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) return;
    const targetStatus = resolveTargetStatus(tasksRef.current, over.id as string);
    if (!targetStatus) return;
    const next = applyStatusChange(tasksRef.current, active.id as string, targetStatus);
    if (next !== tasksRef.current) syncTasks(next);
  }, [syncTasks]);

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    const originStatus = originStatusRef.current;
    originStatusRef.current = null;
    setActiveTask(null);

    if (!over) {
      syncTasks(preDropSnapshotRef.current);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const current = tasksRef.current;

    const targetStatus = resolveTargetStatus(current, overId);
    if (!targetStatus) return;

    const task = current.find((t) => t.id === activeId);
    if (!task) return;

    // `task.status` is already the optimistic value set by onDragOver.
    // Use `originStatus` (captured at drag-start) for the "did status change?" check.
    const statusChanged = originStatus !== null && originStatus !== task.status;

    const isDroppedOnCard = overId !== activeId && !TASK_STATUS_COLUMNS.includes(overId as TaskStatus);
    const next = isDroppedOnCard ? applyReorder(current, activeId, overId) : current;

    if (statusChanged || next !== current) {
      syncTasks(next);
      persistOrder(toReorderPayload(next));
    }
  }, [syncTasks, persistOrder]);

  return {
    tasks,
    activeTask,
    columns: groupByStatus(tasks),
    sensors,
    onDragStart,
    onDragOver,
    onDragEnd,
  };
}
