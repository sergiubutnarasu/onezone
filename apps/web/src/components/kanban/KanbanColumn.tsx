'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export function KanbanColumn({ status, tasks, projectId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

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
        <ScrollArea className="h-[calc(100vh-260px)]">
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {tasks.map((task) => (
                <KanbanCard key={task.id} task={task} projectId={projectId} />
              ))}
              {tasks.length === 0 && (
                <p className="text-xs text-muted-foreground/50 text-center py-10">
                  Drop tasks here
                </p>
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

