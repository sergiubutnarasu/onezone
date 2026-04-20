'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Task } from '@onezone/shared';

interface KanbanCardProps {
  task: Task;
  projectId: string;
}

export function KanbanCard({ task, projectId }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          'cursor-grab active:cursor-grabbing select-none',
          isDragging && 'opacity-50 ring-2 ring-primary',
        )}
      >
        <CardContent className="p-3">
          <Link
            href={`/projects/${projectId}/tasks/${task.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-sm text-primary hover:underline block"
          >
            {task.name}
          </Link>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
