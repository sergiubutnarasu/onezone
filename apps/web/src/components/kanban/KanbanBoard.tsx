'use client';

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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
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

      <DragOverlay>
        {activeTask && <KanbanCard task={activeTask} projectId={projectId} />}
      </DragOverlay>
    </DndContext>
  );
}

