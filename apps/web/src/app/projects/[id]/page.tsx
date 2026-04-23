'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { fetchProject, fetchTasks, fetchTerminals, createTask } from '@/lib/api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Terminal, Task } from '@onezone/shared';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [terminalId, setTerminalId] = useState<string>('');
  const [open, setOpen] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => fetchTasks(id),
  });

  const { data: terminals = [] } = useQuery<Terminal[]>({
    queryKey: ['terminals'],
    queryFn: fetchTerminals,
  });

  const createMutation = useMutation({
    mutationFn: () => createTask(id, { name, description, terminalId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      setName('');
      setDescription('');
      setTerminalId('');
      setOpen(false);
    },
  });

  const noTerminals = terminals.length === 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Page header */}
        <div className="px-8 pt-6 pb-4 border-b border-border/60">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Link href="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="size-3" />
              Projects
            </Link>
            <ChevronRight className="size-3" />
            {projectLoading
              ? <Skeleton className="h-3 w-24" />
              : <span className="text-foreground">{project?.name}</span>
            }
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              {projectLoading ? (
                <>
                  <Skeleton className="h-7 w-48 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </>
              ) : (
                <>
                  <h1 className="text-xl font-semibold tracking-tight">{project?.name}</h1>
                  {project?.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
                  )}
                </>
              )}
            </div>

            <Tooltip>
              <Dialog open={open} onOpenChange={setOpen}>
                <TooltipTrigger
                  render={
                    <DialogTrigger
                      render={<Button disabled={noTerminals} />}
                    />
                  }
                >
                  <Plus data-icon="inline-start" />
                  New Task
                </TooltipTrigger>
                {noTerminals && (
                  <TooltipContent>No terminals available — start one first</TooltipContent>
                )}

                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create task</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 pt-2">
                    <Input
                      placeholder="Task name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <Select value={terminalId} onValueChange={(v) => v != null && setTerminalId(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string) => v
                            ? (terminals.find((t) => t.id === v)?.name ?? v)
                            : <span className="text-muted-foreground">Select a terminal</span>
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {terminals.map((t) => (
                          <SelectItem key={t.id} value={t.id} label={t.name}>
                            <span className={`mr-1.5 ${t.isConnected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                              {t.isConnected ? '●' : '○'}
                            </span>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => createMutation.mutate()}
                      disabled={!name || !terminalId || createMutation.isPending}
                      className="w-full mt-1"
                    >
                      {createMutation.isPending ? 'Creating…' : 'Create task'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Tooltip>
          </div>
        </div>

        <Separator />

        {/* Kanban area */}
        <div className="flex-1 overflow-x-auto p-6">
          {tasksLoading ? (
            <div className="flex gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex flex-col gap-2 min-w-65 w-65">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-[calc(100vh-240px)] w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <KanbanBoard tasks={tasks as Task[]} projectId={id} />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
