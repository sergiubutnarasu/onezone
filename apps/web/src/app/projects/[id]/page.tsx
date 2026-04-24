'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { fetchProject, fetchTasks, fetchTerminals } from '@/lib/api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { EditProjectButton } from '@/components/EditProjectButton';
import { CreateTaskButton } from '@/components/CreateTaskButton';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Terminal, Task } from '@onezone/shared';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();

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

            <div className="flex items-center gap-2">
            <CreateTaskButton projectId={id} terminals={terminals} />

            {project && <EditProjectButton project={project} />}
            </div>
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
