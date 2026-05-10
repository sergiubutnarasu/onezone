'use client';

import { memo, useRef, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KanbanCard } from './KanbanCard';
import { type Task } from '@onezone/shared';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteKanbanColumn } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { KanbanColumnDialog } from '@/components/KanbanColumnDialog';

const COLUMN_COLORS = [
  'text-sky-400',
  'text-amber-400',
  'text-violet-400',
  'text-orange-400',
  'text-emerald-400',
  'text-blue-400',
  'text-pink-400',
  'text-teal-400',
];

interface KanbanColumnProps {
  columnId: string;
  columnName: string;
  columnDescription: string | null;
  columnIndex: number;
  tasks: Task[];
  projectId: string;
  isBacklog: boolean;
}

const CARD_ESTIMATE_PX = 110;

export const KanbanColumn = memo(function KanbanColumn({
  columnId,
  columnName,
  columnDescription,
  columnIndex,
  tasks,
  projectId,
  isBacklog,
}: KanbanColumnProps) {
  // Backlog uses disabled useSortable so it stays droppable but not draggable.
  // Using a single useSortable (instead of mixing useDroppable + useSortable with the same id)
  // avoids the id-conflict that made the backlog invisible to dnd-kit's collision detection.
  const sortable = useSortable({ id: columnId, disabled: isBacklog });

  const setNodeRef = sortable.setNodeRef;
  const isOver = sortable.isOver;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const qc = useQueryClient();

  const itemIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_ESTIMATE_PX,
    gap: 8,
    overscan: 5,
  });

  const colorClass = isBacklog
    ? 'text-slate-400'
    : COLUMN_COLORS[columnIndex % COLUMN_COLORS.length];

  const deleteMutation = useMutation({
    mutationFn: () => deleteKanbanColumn(projectId, columnId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban-columns', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const style = isBacklog ? undefined : {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : undefined,
  };

  return (
    <>
      <div
        className="group/col flex flex-col gap-2 min-w-65 w-65"
        style={style}
        {...(isBacklog ? {} : sortable.attributes)}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {!isBacklog && (
              <button
                className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 touch-none"
                {...sortable.listeners}
                tabIndex={-1}
                aria-label="Drag to reorder column"
              >
                <GripVertical className="size-3.5" />
              </button>
            )}
            <span className={cn('text-xs font-semibold uppercase tracking-wider truncate', colorClass)}>
              {columnName}
            </span>
            <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0">
              {tasks.length}
            </Badge>
          </div>
          {!isBacklog && (
            <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover/col:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}
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

      {!isBacklog && (
        <>
          <KanbanColumnDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            projectId={projectId}
            column={{ id: columnId, name: columnName, description: columnDescription }}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete column"
            description={`Are you sure you want to delete the "${columnName}" column? Tasks in this column will be moved to Backlog.`}
            onConfirm={() => deleteMutation.mutate()}
          />
        </>
      )}
    </>
  );
});
