'use client';

import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Trash2, Bot, MoreHorizontal, Pencil, Monitor } from 'lucide-react';
import { updateTask, assignTaskTerminal, deleteTask, updateTaskStatus } from '@/lib/api';
import { TaskStatus, TASK_STATUS_LABELS, TASK_STATUS_COLUMNS, type Terminal, type Agent, type Task } from '@onezone/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EditTaskDialog } from '@/components/EditTaskDialog';

interface TaskMoreMenuProps {
  task: Task;
  projectId: string;
  agents: Agent[];
  terminals: Terminal[];
  onDeleted: () => void;
}

export function TaskMoreMenu({ task, projectId, agents, terminals, onDeleted }: TaskMoreMenuProps) {
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: (terminalId: string) => assignTaskTerminal(task.id, terminalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus(task.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: onDeleted,
  });

  function handleDelete() {
    if (confirm(`Delete task "${task.name}"? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
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
        {/* Status submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${
                task.status === 'DONE' ? 'bg-emerald-400' :
                task.status === 'IN_PROGRESS' ? 'bg-amber-400' :
                task.status === 'IN_REVIEW' ? 'bg-sky-400' :
                task.status === 'TESTING' ? 'bg-violet-400' :
                task.status === 'TODO' ? 'bg-blue-400' :
                'bg-muted-foreground'
              }`} />
              Change status
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {TASK_STATUS_COLUMNS.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => statusMutation.mutate(s)}
                className="text-xs"
              >
                <span className={`mr-2 size-2 rounded-full ${
                  s === 'DONE' ? 'bg-emerald-400' :
                  s === 'IN_PROGRESS' ? 'bg-amber-400' :
                  s === 'IN_REVIEW' ? 'bg-sky-400' :
                  s === 'TESTING' ? 'bg-violet-400' :
                  s === 'TODO' ? 'bg-blue-400' :
                  'bg-muted-foreground'
                }`} />
                {TASK_STATUS_LABELS[s]}
                {task.status === s && (
                  <span className="ml-auto text-[10px] text-muted-foreground">Current</span>
                )}
              </DropdownMenuItem>
            ))}
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
                    qc.invalidateQueries({ queryKey: ['task', task.id] });
                    qc.invalidateQueries({ queryKey: ['tasks', projectId] });
                  });
                }}
                className="text-xs"
              >
                {a.name}
                {task.agentId === a.id && (
                  <span className="ml-auto text-[10px] text-muted-foreground">Current</span>
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
            {terminals.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => assignMutation.mutate(t.id)}
                className="text-xs"
              >
                <span className={`mr-2 size-2 rounded-full ${t.isConnected ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                {t.name}
                {task.terminalId === t.id && (
                  <span className="ml-auto text-[10px] text-muted-foreground">Current</span>
                )}
              </DropdownMenuItem>
            ))}
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
      open={editOpen}
      onOpenChange={setEditOpen}
    />
  </>
  );
}