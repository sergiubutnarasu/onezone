"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Loader2,
  X,
} from "lucide-react";
import { fetchTasks } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Task } from "@onezone/shared";

interface TaskSidebarProps {
  projectId: string;
  currentTaskId: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function TaskItem({ task, isActive }: { task: Task; isActive: boolean }) {
  const statusIcon = task.completedAt ? (
    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
  ) : task.columnId ? (
    <Circle className="size-3.5 text-sky-400 shrink-0" />
  ) : (
    <Circle className="size-3.5 text-muted-foreground/50 shrink-0" />
  );

  return (
    <Link
      href={`/projects/${task.projectId}/tasks/${task.id}`}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {statusIcon}
      <span className="truncate">{task.name}</span>
    </Link>
  );
}

function SidebarContent({
  projectId,
  currentTaskId,
  onClose,
}: {
  projectId: string;
  currentTaskId: string;
  onClose?: () => void;
}) {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => fetchTasks(projectId),
  });

  const sortedTasks = tasks.sort((a, b) => a.order - b.order);

  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-3" />
          Back to project
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="px-4 py-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Tasks ({tasks.length})
        </h2>
      </div>

      <ScrollArea className="flex-1 h-full min-h-0">
        <div className="p-2 space-y-0.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : sortedTasks.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No tasks</p>
          ) : (
            sortedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                isActive={task.id === currentTaskId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

export function TaskSidebar({
  projectId,
  currentTaskId,
  mobileOpen,
  onMobileClose,
}: TaskSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-card/30 overflow-hidden">
        <SidebarContent
          projectId={projectId}
          currentTaskId={currentTaskId}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed top-0 left-0 h-full w-60 bg-sidebar border-r border-border z-50 flex flex-col lg:hidden overflow-hidden">
            <SidebarContent
              projectId={projectId}
              currentTaskId={currentTaskId}
              onClose={onMobileClose}
            />
          </aside>
        </>
      )}
    </>
  );
}
