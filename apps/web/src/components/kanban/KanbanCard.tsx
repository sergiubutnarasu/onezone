"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { GripVertical, Bot, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@onezone/shared";

interface KanbanCardProps {
  task: Task;
  projectId: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function KanbanCard({ task, projectId }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={cn(
          "relative rounded-lg border border-border/70 bg-card overflow-hidden select-none",
          "transition-all duration-200",
          // glow on hover
          "hover:border-primary/40 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_4px_16px_-4px_hsl(var(--primary)/0.25)]",
          isDragging &&
            "opacity-50 shadow-[0_0_0_2px_hsl(var(--primary)/0.5),0_8px_24px_-4px_hsl(var(--primary)/0.4)]",
        )}
      >
        {/* Subtle top shimmer line */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex group">
          {/* Drag handle */}
          <button
            {...listeners}
            className="flex items-center justify-center w-6 shrink-0 cursor-grab active:cursor-grabbing rounded-l-lg bg-muted/0 hover:bg-primary/10 transition-colors text-muted-foreground/50 hover:text-primary/70 group-hover:text-muted-foreground/70"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>

          {/* Content — entire area navigates to task */}
          <Link
            href={`/projects/${projectId}/tasks/${task.id}`}
            className="flex-1 p-3 pl-1.5 min-w-0 block"
          >
            <p className="text-sm font-medium text-foreground/90 group-hover:text-primary transition-colors leading-snug">
              {task.name}
            </p>

            {/* Footer */}
            <div className="flex flex-col items-start justify-between gap-0.5 mt-2.5 pt-2 border-t border-border/20">
              {task.terminal ? (
                <span className="flex items-center gap-1.5 text-xs min-w-0">
                  <span className="flex items-center justify-center size-4 rounded-full bg-primary/10 shrink-0">
                    <Bot className="size-2.5 text-primary" />
                  </span>
                  <span className="truncate text-muted-foreground">
                    {task.terminal.name}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/50 italic">
                  Unassigned
                </span>
              )}
              {task.agent && (
                <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                  {task.agent.name}
                </span>
              )}
              {task.agent && (
                <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                  {task.model}
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                <Clock className="size-2.5" />
                {timeAgo(task.createdAt)}
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
