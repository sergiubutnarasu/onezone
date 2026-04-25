'use client';

import { memo, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { KanbanCard } from './KanbanCard';
import { TaskStatus, type Task } from '@onezone/shared';
import { TASK_STATUS_LABELS } from '@onezone/shared';

const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: 'text-slate-400',
  [TaskStatus.TODO]: 'text-sky-400',
  [TaskStatus.IN_PROGRESS]: 'text-amber-400',
  [TaskStatus.IN_REVIEW]: 'text-violet-400',
  [TaskStatus.TESTING]: 'text-orange-400',
  [TaskStatus.DONE]: 'text-emerald-400',
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
}

// Approximate card height (px) — used as initial estimate before measurement.
const CARD_ESTIMATE_PX = 110;

export const KanbanColumn = memo(function KanbanColumn({ status, tasks, projectId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const scrollRef = useRef<HTMLDivElement>(null);

  const itemIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_ESTIMATE_PX,
    gap: 8,
    overscan: 5,
  });

  return (
    <div className="flex flex-col gap-2 min-w-65 w-65">
      <div className="flex items-center justify-between px-1">
        <span className={cn('text-xs font-semibold uppercase tracking-wider', STATUS_COLORS[status])}>
          {TASK_STATUS_LABELS[status]}
        </span>
        <Badge variant="secondary" className="text-xs h-5 px-1.5">
          {tasks.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-lg border border-border/70 bg-muted/40 p-2 transition-colors',
          isOver && 'bg-primary/5 border-primary/40',
        )}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div
            ref={scrollRef}
            className="h-[calc(100vh-260px)] overflow-y-auto"
          >
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-10">
                Drop tasks here
              </p>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const task = tasks[virtualRow.index];
                  return (
                    <div
                      key={task.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <KanbanCard task={task} projectId={projectId} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
});

