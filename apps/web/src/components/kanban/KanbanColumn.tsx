"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { KanbanColumnDialog } from "@/components/KanbanColumnDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteKanbanColumn } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Task } from "@onezone/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2, GripVertical, Pencil, Trash2 } from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import { KanbanCard } from "./KanbanCard";

const COLUMN_COLORS = [
  "text-sky-400",
  "text-amber-400",
  "text-violet-400",
  "text-orange-400",
  "text-emerald-400",
  "text-blue-400",
  "text-pink-400",
  "text-teal-400",
];

interface KanbanColumnProps {
  columnId: string;
  columnName: string;
  columnInstructions: string | null;
  columnIndex: number;
  columnAgentId?: string | null;
  columnModel?: string | null;
  tasks: Task[];
  projectId: string;
  isBacklog: boolean;
  isCompleted?: boolean;
}

const CARD_ESTIMATE_PX = 118;
const CARD_GAP_PX = 8;

export const KanbanColumn = memo(function KanbanColumn({
  columnId,
  columnName,
  columnInstructions,
  columnIndex,
  columnAgentId,
  columnModel,
  tasks,
  projectId,
  isBacklog,
  isCompleted = false,
}: KanbanColumnProps) {
  // Backlog and Completed use disabled useSortable so they stay droppable but not draggable.
  const sortable = useSortable({
    id: columnId,
    disabled: isBacklog || isCompleted,
  });

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
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const topSpacerHeight = virtualRows[0]?.start ?? 0;
  const bottomSpacerHeight =
    virtualRows.length > 0
      ? Math.max(
          0,
          virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end,
        )
      : 0;

  const colorClass = isBacklog
    ? "text-slate-400"
    : isCompleted
      ? "text-success"
      : COLUMN_COLORS[columnIndex % COLUMN_COLORS.length];

  const deleteMutation = useMutation({
    mutationFn: () => deleteKanbanColumn(projectId, columnId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-columns", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const style =
    isBacklog || isCompleted
      ? undefined
      : {
          transform: CSS.Transform.toString(sortable.transform),
          transition: sortable.transition,
          opacity: sortable.isDragging ? 0.4 : undefined,
        };

  return (
    <>
      <div
        className="group/col flex flex-col gap-2 min-w-65 w-65 h-full"
        style={style}
        {...(isBacklog || isCompleted ? {} : sortable.attributes)}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isCompleted && (
              <CheckCircle2 className="size-3.5 text-success shrink-0" />
            )}
            {!isBacklog && !isCompleted && (
              <button
                className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 touch-none"
                {...sortable.listeners}
                tabIndex={-1}
                aria-label="Drag to reorder column"
              >
                <GripVertical className="size-3.5" />
              </button>
            )}
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-wider truncate",
                colorClass,
              )}
            >
              {columnName}
            </span>
            <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0">
              {tasks.length}
            </Badge>
          </div>
          {!isBacklog && !isCompleted && (
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
            "flex-1 rounded-lg border border-border/70 bg-muted/40 p-2 transition-colors min-h-0",
            isOver && "bg-primary/5 border-primary/40",
          )}
        >
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            <div ref={scrollRef} className="h-full overflow-y-auto chat-scroll">
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 text-center py-10">
                  Drop tasks here
                </p>
              ) : (
                <div>
                  {topSpacerHeight > 0 && (
                    <div style={{ height: topSpacerHeight }} />
                  )}
                  {virtualRows.map((virtualRow) => (
                    <div
                      key={tasks[virtualRow.index].id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        paddingBottom:
                          virtualRow.index === tasks.length - 1
                            ? 0
                            : CARD_GAP_PX,
                      }}
                    >
                      <KanbanCard
                        task={tasks[virtualRow.index]}
                        projectId={projectId}
                      />
                    </div>
                  ))}
                  {bottomSpacerHeight > 0 && (
                    <div style={{ height: bottomSpacerHeight }} />
                  )}
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>

      {!isBacklog && !isCompleted && (
        <>
          <KanbanColumnDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            projectId={projectId}
            column={{
              id: columnId,
              name: columnName,
              instructions: columnInstructions,
              agentId: columnAgentId,
              model: columnModel,
            }}
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
