"use client";

import Link from "next/link";
import {
  Home,
  ChevronRight,
  Wifi,
  WifiOff,
  Bot,
  Cpu,
  Loader2,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/CopyButton";
import { TaskMoreMenu } from "@/components/TaskMoreMenu";
import { type Terminal, type Agent, type Task, type KanbanColumn } from "@onezone/shared";

interface TaskMetaChipsProps {
  task: Task;
  columns: KanbanColumn[];
  isTerminalActive: boolean;
}

function TaskMetaChips({ task, columns, isTerminalActive }: TaskMetaChipsProps) {
  const columnName = task.columnId ? (columns.find((c) => c.id === task.columnId)?.name ?? null) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {/* Column chip */}
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-muted text-muted-foreground border-border">
        {isTerminalActive ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <span className="size-1.5 rounded-full bg-muted-foreground" />
        )}
        {columnName ?? 'Backlog'}
      </span>

      {/* Terminal chip */}
      {task.terminal ? (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
            task.terminal.isConnected
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${task.terminal.isConnected ? "bg-emerald-400" : "bg-muted-foreground"}`}
          />
          {task.terminal.name}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-destructive/10 text-destructive border-destructive/20">
          <span className="size-1.5 rounded-full bg-destructive" />
          No terminal
        </span>
      )}

      {/* Agent chip */}
      {task.agent && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
          <Bot className="size-3" />
          {task.agent.name}
        </span>
      )}

      {/* Model chip */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted text-muted-foreground border border-border">
        <Cpu className="size-3" />
        {task.model}
      </span>

      {/* Repository chip */}
      {task.project?.repository && (
        <a
          href={task.project.repository}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border hover:text-foreground transition-colors"
        >
          <GitBranch className="size-3" />
          Repository
        </a>
      )}
    </div>
  );
}

interface TaskHeaderProps {
  projectId: string;
  taskId: string;
  task: Task | undefined;
  isConnected: boolean;
  isTerminalActive: boolean;
  agents: Agent[];
  terminals: Terminal[];
  columns: KanbanColumn[];
  onDeleted: () => void;
}

export function TaskHeader({
  projectId,
  taskId,
  task,
  isConnected,
  isTerminalActive,
  agents,
  terminals,
  columns,
  onDeleted,
}: TaskHeaderProps) {
  return (
    <div className="px-5 py-4 border-b border-border/60 bg-card/50 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
        <Link
          href="/"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Home className="size-3" />
          Projects
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-foreground transition-colors"
        >
          Project
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground truncate max-w-50">
          {task?.name ?? "Loading…"}
        </span>
      </div>

      {/* Main header content */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: Title */}
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight truncate">
            {task?.name ?? "Loading…"}
          </h1>

          {!task && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[11px] text-muted-foreground/50 font-mono">
                {taskId.slice(0, 8)}
              </span>
              <CopyButton value={taskId} />
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className={
              isConnected
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 h-7"
                : "text-muted-foreground h-7"
            }
          >
            {isConnected ? (
              <Wifi className="size-3 mr-1" />
            ) : (
              <WifiOff className="size-3 mr-1" />
            )}
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>

          {task && (
            <TaskMoreMenu
              task={task}
              projectId={projectId}
              agents={agents}
              terminals={terminals}
              columns={columns}
              onDeleted={onDeleted}
            />
          )}
        </div>
      </div>

      {/* ID chip */}
      <div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 font-mono">
          {taskId}
          <CopyButton value={taskId} />
        </span>
      </div>

      {/* Meta chips */}
      {task && <TaskMetaChips task={task} columns={columns} isTerminalActive={isTerminalActive} />}
    </div>
  );
}
