"use client";

import { useState } from "react";
import {
  Wifi,
  WifiOff,
  Bot,
  Cpu,
  Monitor,
  GitBranch,
  CheckCircle2,
  Circle,
  Loader2,
  Pencil,
  Play,
  Trash2,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTaskMutations } from "./useTaskMutations";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  COMPLETED_COLUMN_ID,
  type Task,
  type Agent,
  type Terminal,
  type KanbanColumn,
} from "@onezone/shared";

interface TaskInfoPanelProps {
  task: Task;
  projectId: string;
  isTerminalConnected: boolean;
  isTerminalActive: boolean;
  agents: Agent[];
  terminals: Terminal[];
  columns: KanbanColumn[];
  onDeleted: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold select-none">
      {children}
    </div>
  );
}

export function TaskInfoPanel({
  task,
  projectId,
  isTerminalConnected,
  isTerminalActive,
  agents,
  terminals,
  columns,
  onDeleted,
  mobileOpen,
  onMobileClose,
}: TaskInfoPanelProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { assignMutation, columnMutation, agentMutation, deleteMutation } =
    useTaskMutations(task, projectId, onDeleted);

  const nextColumn = [...columns].sort((a, b) => a.index - b.index)[0];
  const isBacklogTask = task.columnId === null && !task.completedAt;

  const currentColumnName = task.completedAt
    ? "Completed"
    : task.columnId
      ? (columns.find((c) => c.id === task.columnId)?.name ?? "Unknown")
      : "Backlog";

  const panelContent = (
    <>
      <ScrollArea className="flex-1 h-full min-h-0">
        <div className="px-4 py-3 space-y-3">
          {/* Connection */}
          <div className="space-y-2">
            <SectionLabel>Connection</SectionLabel>
            <div
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 ring-1",
                isTerminalConnected
                  ? "text-emerald-400 ring-emerald-500/15 bg-emerald-500/5"
                  : "text-muted-foreground ring-foreground/5",
              )}
            >
              {isTerminalConnected ? (
                <Wifi className="size-3.5" />
              ) : (
                <WifiOff className="size-3.5" />
              )}
              <span className="text-xs font-medium">
                {isTerminalConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div className="space-y-2">
            <SectionLabel>Status</SectionLabel>
            {isBacklogTask && (
              <Button
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  if (nextColumn) columnMutation.mutate(nextColumn.id);
                }}
                disabled={!nextColumn || !isTerminalConnected || columnMutation.isPending}
              >
                {columnMutation.isPending ? (
                  <Loader2 className="size-3 mr-2 animate-spin" />
                ) : (
                  <Play className="size-3 mr-2" />
                )}
                Start
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-left hover:bg-muted/50 transition-colors group">
                  {task.completedAt ? (
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="size-3.5 text-sky-400 shrink-0" />
                  )}
                  <span className="text-xs font-medium flex-1 truncate">
                    {currentColumnName}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => columnMutation.mutate(null)}
                  className="text-xs"
                >
                  Backlog
                  {task.columnId === null && !task.completedAt && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Current
                    </span>
                  )}
                </DropdownMenuItem>
                {columns.map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    onClick={() => columnMutation.mutate(col.id)}
                    className="text-xs"
                  >
                    {col.name}
                    {!task.completedAt && task.columnId === col.id && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        Current
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => columnMutation.mutate(COMPLETED_COLUMN_ID)}
                  className="text-xs"
                >
                  Completed
                  {task.completedAt && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Current
                    </span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator />

          {/* Terminal */}
          <div className="space-y-2">
            <SectionLabel>Terminal</SectionLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-left hover:bg-muted/50 transition-colors group">
                  <Monitor className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs flex-1 truncate">
                    {task.terminal?.name ?? "Not assigned"}
                  </span>
                  {task.terminal && (
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        task.terminal.isConnected
                          ? "bg-emerald-400"
                          : "bg-muted-foreground/50",
                      )}
                    />
                  )}
                  {isTerminalActive && (
                    <Loader2 className="size-3 animate-spin text-amber-400 shrink-0" />
                  )}
                  <ChevronDown className="size-3 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {terminals.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    No terminals
                  </div>
                ) : (
                  terminals.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => assignMutation.mutate(t.id)}
                      className="text-xs"
                    >
                      {t.name}
                      {task.terminal?.id === t.id && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          Current
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator />

          {/* Agent */}
          <div className="space-y-2">
            <SectionLabel>Agent</SectionLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-left hover:bg-muted/50 transition-colors group">
                  <Bot className="size-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium flex-1 truncate">
                    {task.agent?.name ?? "Unknown"}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {agents.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onClick={() => agentMutation.mutate(a.id)}
                    className="text-xs"
                  >
                    {a.name}
                    {task.agentId === a.id && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        Current
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator />

          {/* Model */}
          <div className="space-y-2">
            <SectionLabel>Model</SectionLabel>
            <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5">
              <Cpu className="size-3.5 text-violet-400 shrink-0" />
              <span className="text-xs font-mono">{task.model}</span>
            </div>
          </div>

          {/* Repository */}
          {task.project?.repository && (
            <>
              <Separator />
              <div className="space-y-2">
                <SectionLabel>Repository</SectionLabel>
                <a
                  href={task.project.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="text-xs truncate">
                    {task.project.repository}
                  </span>
                </a>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="space-y-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3 mr-2" />
              Edit task
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-3 mr-2" />
              Delete task
            </Button>
          </div>
        </div>
      </ScrollArea>

      <EditTaskDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        projectId={projectId}
        agents={agents}
        columns={columns}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete task"
        description={`Are you sure you want to delete "${task.name}"? This action cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );

  return (
    <>
      {/* Desktop panel */}
      <aside className="hidden xl:flex flex-col w-64 shrink-0 border-l border-border bg-card/30 overflow-hidden">
        {panelContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 xl:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed top-0 right-0 h-full w-72 bg-sidebar border-l border-border z-50 flex flex-col xl:hidden overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">Task Info</h2>
              <button
                onClick={onMobileClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close info panel"
              >
                <X className="size-4" />
              </button>
            </div>
            {panelContent}
          </aside>
        </>
      )}
    </>
  );
}
