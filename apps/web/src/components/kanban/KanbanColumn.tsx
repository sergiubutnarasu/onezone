'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { KanbanCard } from './KanbanCard';
import type { Task, TaskStatus } from '@onezone/shared';
import { TASK_STATUS_LABELS } from '@onezone/shared';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
}

export function KanbanColumn({ status, tasks, projectId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col gap-2 min-w-65 w-65">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-foreground">
          {TASK_STATUS_LABELS[status]}
        </span>
        <Badge variant="secondary" className="text-xs">
          {tasks.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-lg border bg-muted/40 p-2 transition-colors',
          isOver && 'bg-primary/10 border-primary',
        )}
      >
        <ScrollArea className="h-[calc(100vh-220px)]">
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2 pr-2">
              {tasks.map((task) => (
                <KanbanCard key={task.id} task={task} projectId={projectId} />
              ))}
              {tasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No tasks
                </p>
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}
