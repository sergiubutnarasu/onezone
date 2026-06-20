"use client";

import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Trash2, Bot, MoreHorizontal, Pencil, Monitor } from "lucide-react";
import {
  updateTask,
  assignTaskTerminal,
  deleteTask,
  updateTaskColumn,
  setTaskCompleted,
} from "@/lib/api";
import {
  COMPLETED_COLUMN_ID,
  type KanbanColumn,
  type Terminal,
  type Agent,
  type Task,
} from "@onezone/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface TaskMoreMenuProps {
  task: Task;
  projectId: string;
  agents: Agent[];
  terminals: Terminal[];
  columns: KanbanColumn[];
  onDeleted: () => void;
}

export function TaskMoreMenu({
  task,
  projectId,
  agents,
  terminals,
  columns,
  onDeleted,
}: TaskMoreMenuProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: (terminalId: string) => assignTaskTerminal(task.id, terminalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const columnMutation = useMutation({
    mutationFn: async (columnId: string | null) => {
      if (columnId === COMPLETED_COLUMN_ID) {
        return setTaskCompleted(task.id, true);
      }
      return updateTaskColumn(task.id, columnId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      onDeleted();
    },
  });

  function handleDelete() {
    setConfirmOpen(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" className="h-7 w-7">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* Column submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-muted-foreground" />
                Move to column
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {/* Backlog is always first */}
              <DropdownMenuItem
                onClick={() => columnMutation.mutate(null)}
                className="text-xs"
              >
                Backlog
                {task.columnId === null && (
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
                {!!task.completedAt && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Current
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Agent submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex items-center gap-2">
                <Bot className="size-3.5" />
                Change agent
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {agents.map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  onClick={() => {
                    updateTask(task.id, { agentId: a.id }).then(() => {
                      qc.invalidateQueries({ queryKey: ["task", task.id] });
                      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
                    });
                  }}
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
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Terminal submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex items-center gap-2">
                <Monitor className="size-3.5" />
                Change terminal
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
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
                    <span
                      className={`mr-2 size-2 rounded-full ${t.isConnected ? "bg-emerald-400" : "bg-muted-foreground"}`}
                    />
                    {t.name}
                    {task.terminal?.id === t.id && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        Current
                      </span>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* Edit */}
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-3.5" />
            Edit task
          </DropdownMenuItem>

          {/* Delete */}
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 size-3.5" />
            Delete task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditTaskDialog
        task={task}
        projectId={projectId}
        agents={agents}
        columns={columns}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete task"
        description={`Delete task "${task.name}"? This cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
