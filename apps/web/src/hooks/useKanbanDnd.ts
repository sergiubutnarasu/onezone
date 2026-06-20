'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { reorderTasks, reorderKanbanColumns, setTaskCompleted, type TaskOrderItem } from '@/lib/api';
import { BACKLOG_COLUMN_ID, COMPLETED_COLUMN_ID, type KanbanColumn, type Task } from '@onezone/shared';

// ---------------------------------------------------------------------------
// Pure helpers (no side-effects, easy to unit-test)
// ---------------------------------------------------------------------------

/** All valid droppable IDs: BACKLOG_COLUMN_ID, COMPLETED_COLUMN_ID, or a real column UUID */
function resolveTargetColumnId(tasks: Task[], columns: KanbanColumn[], overId: string): string | undefined {
  if (overId === BACKLOG_COLUMN_ID) return BACKLOG_COLUMN_ID;
  if (overId === COMPLETED_COLUMN_ID) return COMPLETED_COLUMN_ID;
  if (columns.some((c) => c.id === overId)) return overId;
  const overTask = tasks.find((t) => t.id === overId);
  if (!overTask) return undefined;
  if (overTask.completedAt) return COMPLETED_COLUMN_ID;
  return overTask.columnId ?? BACKLOG_COLUMN_ID;
}

function applyColumnChange(tasks: Task[], activeId: string, targetColumnId: string): Task[] {
  const task = tasks.find((t) => t.id === activeId);
  if (!task) return tasks;

  if (targetColumnId === COMPLETED_COLUMN_ID) {
    // Moving to Completed: set completedAt, keep columnId
    if (task.completedAt) return tasks;
    return tasks.map((t) => (t.id === activeId ? { ...t, completedAt: new Date().toISOString() } : t));
  }

  const newColumnId = targetColumnId === BACKLOG_COLUMN_ID ? null : targetColumnId;
  const completedAtNeedsClear = !!task.completedAt;
  if (task.columnId === newColumnId && !completedAtNeedsClear) return tasks;
  return tasks.map((t) => (t.id === activeId ? { ...t, columnId: newColumnId, completedAt: null } : t));
}

function applyReorder(tasks: Task[], activeId: string, overId: string): Task[] {
  const oldIndex = tasks.findIndex((t) => t.id === activeId);
  const newIndex = tasks.findIndex((t) => t.id === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return tasks;
  return arrayMove(tasks, oldIndex, newIndex);
}

function toReorderPayload(tasks: Task[]): TaskOrderItem[] {
  const counters = new Map<string | null, number>();
  // Sort tasks by the column order so ordering is consistent
  return tasks.map((t) => {
    const key = t.columnId ?? null;
    const order = counters.get(key) ?? 0;
    counters.set(key, order + 1);
    return { id: t.id, columnId: t.columnId ?? null, order };
  });
}

export function groupByColumn(tasks: Task[], columns: KanbanColumn[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  groups.set(BACKLOG_COLUMN_ID, []);
  groups.set(COMPLETED_COLUMN_ID, []);
  for (const col of columns) groups.set(col.id, []);
  for (const task of tasks) {
    if (task.completedAt) {
      groups.get(COMPLETED_COLUMN_ID)!.push(task);
    } else {
      const key = task.columnId ?? BACKLOG_COLUMN_ID;
      const group = groups.get(key);
      if (group) group.push(task);
      else groups.get(BACKLOG_COLUMN_ID)!.push(task);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface KanbanDnd {
  tasks: Task[];
  activeTask: Task | null;
  activeColumn: KanbanColumn | null;
  orderedColumns: KanbanColumn[];
  columns: Map<string, Task[]>;
  sensors: ReturnType<typeof useSensors>;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export function useKanbanDnd(projectId: string, initialTasks: Task[], kanbanColumns: KanbanColumn[]): KanbanDnd {
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<KanbanColumn | null>(null);
  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>(kanbanColumns);

  const tasksRef = useRef<Task[]>(initialTasks);
  const originColumnIdRef = useRef<string | null | undefined>(undefined);
  const preDropSnapshotRef = useRef<Task[]>(initialTasks);
  const columnsRef = useRef<KanbanColumn[]>(kanbanColumns);
  const preDropColumnsRef = useRef<KanbanColumn[]>(kanbanColumns);

  const syncTasks = useCallback((next: Task[]) => {
    tasksRef.current = next;
    setTasks(next);
  }, []);

  useEffect(() => {
    syncTasks(initialTasks);
    preDropSnapshotRef.current = initialTasks;
  }, [initialTasks, syncTasks]);

  useEffect(() => {
    columnsRef.current = kanbanColumns;
    setLocalColumns(kanbanColumns);
    preDropColumnsRef.current = kanbanColumns;
  }, [kanbanColumns]);

  const { mutate: persistOrder } = useMutation({
    mutationFn: (items: TaskOrderItem[]) => reorderTasks(projectId, items),
    onSuccess: (updated: Task[]) => {
      syncTasks(updated);
      qc.setQueryData(['tasks', projectId], updated);
      const prevMap = new Map(preDropSnapshotRef.current.map((t) => [t.id, t.columnId]));
      for (const t of updated) {
        if (prevMap.get(t.id) !== t.columnId) {
          qc.invalidateQueries({ queryKey: ['task', t.id] });
        }
      }
    },
    onError: () => {
      syncTasks(preDropSnapshotRef.current);
    },
  });

  const { mutate: persistCompleted } = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      setTaskCompleted(taskId, completed),
    onSuccess: (updated: Task) => {
      syncTasks(tasksRef.current.map((t) => (t.id === updated.id ? { ...t, completedAt: updated.completedAt ?? null } : t)));
      qc.invalidateQueries({ queryKey: ['task', updated.id] });
    },
    onError: () => {
      syncTasks(preDropSnapshotRef.current);
    },
  });

  const { mutate: persistColumnOrder } = useMutation({
    mutationFn: (cols: KanbanColumn[]) =>
      reorderKanbanColumns(projectId, cols.map((c, i) => ({ id: c.id, index: i }))),
    onSuccess: (updated: KanbanColumn[]) => {
      setLocalColumns(updated);
      columnsRef.current = updated;
      qc.setQueryData(['kanban-columns', projectId], updated);
    },
    onError: () => {
      setLocalColumns(preDropColumnsRef.current);
      columnsRef.current = preDropColumnsRef.current;
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const col = columnsRef.current.find((c) => c.id === active.id);
    if (col) {
      setActiveColumn(col);
      preDropColumnsRef.current = columnsRef.current;
      return;
    }
    const task = (active.data.current?.task as Task) ?? null;
    setActiveTask(task);
    // Track virtual origin: COMPLETED for tasks with completedAt set
    originColumnIdRef.current = task?.completedAt
      ? COMPLETED_COLUMN_ID
      : (task?.columnId ?? BACKLOG_COLUMN_ID);
    preDropSnapshotRef.current = tasksRef.current;
  }, []);

  const onDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) return;

    // Column reorder: optimistic move
    if (columnsRef.current.some((c) => c.id === active.id)) {
      const oldIdx = columnsRef.current.findIndex((c) => c.id === active.id);
      const newIdx = columnsRef.current.findIndex((c) => c.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const next = arrayMove(columnsRef.current, oldIdx, newIdx);
        columnsRef.current = next;
        setLocalColumns(next);
      }
      return;
    }

    const targetColumnId = resolveTargetColumnId(tasksRef.current, columnsRef.current, over.id as string);
    if (!targetColumnId) return;
    const next = applyColumnChange(tasksRef.current, active.id as string, targetColumnId);
    if (next !== tasksRef.current) syncTasks(next);
  }, [syncTasks]);

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    // Column drop
    if (columnsRef.current.some((c) => c.id === active.id) || activeColumn) {
      setActiveColumn(null);
      if (over && columnsRef.current.some((c) => c.id === active.id)) {
        persistColumnOrder(columnsRef.current);
      } else {
        // Dropped outside — revert
        setLocalColumns(preDropColumnsRef.current);
        columnsRef.current = preDropColumnsRef.current;
      }
      return;
    }

    const originVirtualColumnId = originColumnIdRef.current;
    originColumnIdRef.current = undefined;
    setActiveTask(null);

    if (!over) {
      syncTasks(preDropSnapshotRef.current);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const current = tasksRef.current;

    const targetColumnId = resolveTargetColumnId(current, columnsRef.current, overId);
    if (!targetColumnId) return;

    const task = current.find((t) => t.id === activeId);
    if (!task) return;

    const virtualColumnChanged = originVirtualColumnId !== targetColumnId;

    // Moving TO Completed virtual column
    if (targetColumnId === COMPLETED_COLUMN_ID) {
      if (virtualColumnChanged) {
        persistCompleted({ taskId: activeId, completed: true });
      }
      return;
    }

    // Moving FROM Completed virtual column
    if (originVirtualColumnId === COMPLETED_COLUMN_ID) {
      const originalTask = preDropSnapshotRef.current.find((t) => t.id === activeId);
      const originalColumnId = originalTask?.columnId ?? null;
      const nextColumnId = targetColumnId === BACKLOG_COLUMN_ID ? null : targetColumnId;
      const underlyingColumnChanged = originalColumnId !== nextColumnId;
      const isDroppedOnCard = overId !== activeId && !columnsRef.current.some((c) => c.id === overId) && overId !== BACKLOG_COLUMN_ID && overId !== COMPLETED_COLUMN_ID;
      const next = isDroppedOnCard ? applyReorder(current, activeId, overId) : current;
      if (next !== current) syncTasks(next);
      persistOrder(toReorderPayload(next));
      if (!underlyingColumnChanged) {
        persistCompleted({ taskId: activeId, completed: false });
      }
      return;
    }

    // Regular column change or reorder
    const isDroppedOnCard = overId !== activeId && !columnsRef.current.some((c) => c.id === overId) && overId !== BACKLOG_COLUMN_ID && overId !== COMPLETED_COLUMN_ID;
    const next = isDroppedOnCard ? applyReorder(current, activeId, overId) : current;

    if (virtualColumnChanged || next !== current) {
      syncTasks(next);
      persistOrder(toReorderPayload(next));
    }
  }, [syncTasks, persistOrder, persistCompleted, persistColumnOrder, activeColumn]);

  const columns = useMemo(
    () => groupByColumn(tasks, localColumns),
    [tasks, localColumns],
  );

  return { tasks, activeTask, activeColumn, orderedColumns: localColumns, columns, sensors, onDragStart, onDragOver, onDragEnd };
}
