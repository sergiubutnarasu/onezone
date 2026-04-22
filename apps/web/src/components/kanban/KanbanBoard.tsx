'use client';

import { useRef, useEffect } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useKanbanDnd } from '@/hooks/useKanbanDnd';
import { TASK_STATUS_COLUMNS, type Task } from '@onezone/shared';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { KanbanCard } from './KanbanCard';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
}

export function KanbanBoard({ tasks: initialTasks, projectId }: KanbanBoardProps) {
  const { columns, activeTask, sensors, onDragStart, onDragOver, onDragEnd } =
    useKanbanDnd(projectId, initialTasks);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const viewport = el.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // If the event originates inside a vertically scrollable element, let it scroll vertically.
      let node = e.target as HTMLElement | null;
      while (node && node !== viewport) {
        if (node.scrollHeight > node.clientHeight && getComputedStyle(node).overflowY !== 'hidden') {
          const atTop = node.scrollTop === 0;
          const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight;
          if (!(atTop && e.deltaY < 0) && !(atBottom && e.deltaY > 0)) return;
        }
        node = node.parentElement;
      }
      e.preventDefault();
      viewport.scrollLeft += e.deltaY;
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div ref={wrapperRef}>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {TASK_STATUS_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columns[status]}
              projectId={projectId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      </div>

      <DragOverlay>
        {activeTask && <KanbanCard task={activeTask} projectId={projectId} />}
      </DragOverlay>
    </DndContext>
  );
}

