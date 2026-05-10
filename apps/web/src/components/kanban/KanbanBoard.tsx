'use client';

import { useRef, useEffect, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useKanbanDnd } from '@/hooks/useKanbanDnd';
import { BACKLOG_COLUMN_ID, type KanbanColumn, type Task } from '@onezone/shared';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { KanbanCard } from './KanbanCard';
import { KanbanColumn as KanbanColumnComponent } from './KanbanColumn';
import { KanbanColumnDialog } from '@/components/KanbanColumnDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
  columns: KanbanColumn[];
}

export function KanbanBoard({ tasks: initialTasks, projectId, columns }: KanbanBoardProps) {
  const { columns: groupedTasks, activeTask, activeColumn, orderedColumns, sensors, onDragStart, onDragOver, onDragEnd } =
    useKanbanDnd(projectId, initialTasks, columns);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const viewport = el.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
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
            {/* Static backlog column — always first */}
            <KanbanColumnComponent
              columnId={BACKLOG_COLUMN_ID}
              columnName="Backlog"
              columnDescription={null}
              columnIndex={-1}
              tasks={groupedTasks.get(BACKLOG_COLUMN_ID) ?? []}
              projectId={projectId}
              isBacklog
            />
            {/* Dynamic columns — sortable by drag */}
            <SortableContext
              items={orderedColumns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {orderedColumns.map((col) => (
                <KanbanColumnComponent
                  key={col.id}
                  columnId={col.id}
                  columnName={col.name}
                  columnDescription={col.description ?? null}
                  columnIndex={col.index}
                  tasks={groupedTasks.get(col.id) ?? []}
                  projectId={projectId}
                  isBacklog={false}
                />
              ))}
            </SortableContext>

            {/* Add column button */}
            <div className="flex flex-col gap-2 min-w-40 w-40">
              <div className="flex-1 rounded-lg border border-dashed border-border/50 flex items-start justify-center pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground gap-1.5"
                  onClick={() => setAddColumnOpen(true)}
                >
                  <Plus className="size-4" />
                  Add column
                </Button>
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <DragOverlay>
        {activeTask && <KanbanCard task={activeTask} projectId={projectId} />}
        {activeColumn && (
          <div className="min-w-65 w-65 rounded-lg border border-border/70 bg-muted/40 p-2 opacity-80 shadow-lg cursor-grabbing">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {activeColumn.name}
            </span>
          </div>
        )}
      </DragOverlay>

      <KanbanColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        projectId={projectId}
      />
    </DndContext>
  );
}

