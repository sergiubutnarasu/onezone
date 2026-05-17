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
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  isConnected: boolean;
  isTerminalActive: boolean;
  agents: Agent[];
  terminals: Terminal[];
  columns: KanbanColumn[];
  onDeleted: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function StatusBadge({
  task,
  columns,
}: {
  task: Task;
  columns: KanbanColumn[];
}) {
  if (task.completedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <CheckCircle2 className="size-4" />
        <span className="text-sm font-medium">Completed</span>
      </span>
    );
  }

  const columnName = task.columnId
    ? (columns.find((c) => c.id === task.columnId)?.name ?? "Unknown")
    : "Backlog";

  return (
    <span className="inline-flex items-center gap-1.5 text-sky-400">
      <Circle className="size-4" />
      <span className="text-sm font-medium">{columnName}</span>
    </span>
  );
}

export function TaskInfoPanel({
  task,
  projectId,
  isConnected,
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

  const panelContent = (
    <>
      <ScrollArea className="flex-1 h-full min-h-0">
        <div className="p-4 space-y-4">
          {/* Connection Status */}
          <Card
            size="sm"
            className={cn(
              "ring-1",
              isConnected ? "ring-emerald-500/20" : "ring-foreground/10",
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Connection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "flex items-center gap-2",
                  isConnected ? "text-emerald-400" : "text-muted-foreground",
                )}
              >
                {isConnected ? (
                  <Wifi className="size-4" />
                ) : (
                  <WifiOff className="size-4" />
                )}
                <span className="text-sm font-medium">
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <StatusBadge task={task} columns={columns} />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Change status
                  </Button>
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
            </CardContent>
          </Card>

          {/* Terminal */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Terminal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="size-4 text-muted-foreground" />
                <span className="text-sm">
                  {task.terminal?.name ?? "Not assigned"}
                </span>
                {task.terminal && (
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      task.terminal.isConnected
                        ? "bg-emerald-400"
                        : "bg-muted-foreground",
                    )}
                  />
                )}
              </div>

              {isTerminalActive && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <Loader2 className="size-3 animate-spin" />
                  Running
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Change terminal
                  </Button>
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
            </CardContent>
          </Card>

          {/* Agent */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                <span className="text-sm font-medium">
                  {task.agent?.name ?? "Unknown"}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Change agent
                  </Button>
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
            </CardContent>
          </Card>

          {/* Model */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-violet-400" />
                <span className="text-sm font-mono">{task.model}</span>
              </div>
            </CardContent>
          </Card>

          {/* Repository */}
          {task.project?.repository && (
            <Card size="sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Repository
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={task.project.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <GitBranch className="size-4 shrink-0" />
                  <span className="truncate">{task.project.repository}</span>
                </a>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3 mr-1.5" />
                Edit task
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-3 mr-1.5" />
                Delete task
              </Button>
            </CardContent>
          </Card>
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
      <aside className="hidden xl:flex flex-col w-72 shrink-0 border-l border-border bg-card/30 overflow-hidden">
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
