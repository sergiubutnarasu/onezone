"use client";

import { CollapsibleDescription } from "@/components/CollapsibleDescription";
import { CopyButton } from "@/components/CopyButton";
import { CreateTaskButton } from "@/components/CreateTaskButton";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { ProjectCostStats } from "@/components/ProjectCostStats";
import { SchedulesButton } from "@/components/SchedulesButton";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProjectTasksSocket } from "@/hooks/useProjectTasksSocket";
import {
  fetchAgents,
  fetchKanbanColumns,
  fetchProject,
  fetchProjectCostStats,
  fetchTasks,
  fetchTerminals,
} from "@/lib/api";
import type { ProjectInfo as Project, Agent, KanbanColumn, Task, Terminal } from "@onezone/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Hash, Home, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();

  useProjectTasksSocket(id);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks", id],
    queryFn: () => fetchTasks(id),
  });

  const { data: terminals = [] } = useQuery<Terminal[]>({
    queryKey: ["terminals"],
    queryFn: fetchTerminals,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const { data: columns = [] } = useQuery<KanbanColumn[]>({
    queryKey: ["kanban-columns", id],
    queryFn: () => fetchKanbanColumns(id),
  });

  const { data: costStats } = useQuery({
    queryKey: ["project-cost-stats", id],
    queryFn: () => fetchProjectCostStats(id),
  });

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full gap-4 overflow-hidden">
        {/* Page header */}
        <div className="px-8 pt-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3" />
              Projects
            </Link>
            <ChevronRight className="size-3" />
            {projectLoading ? (
              <Skeleton className="h-3 w-24" />
            ) : (
              <span className="text-foreground">{project?.name}</span>
            )}
          </div>

          <div className="flex items-baseline gap-4 justify-between">
            {projectLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <h1 className="text-display text-balance">
                {project?.name}
              </h1>
            )}

            <div className="flex items-center gap-2">
              {projectLoading ? (
                <>
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-8 w-8" />
                </>
              ) : (
                <>
                  <CreateTaskButton
                    projectId={id}
                    project={project ?? null}
                    terminals={terminals}
                    agents={agents}
                  />

                  <SchedulesButton
                    projectId={id}
                    project={project ?? null}
                    terminals={terminals}
                    agents={agents}
                    columns={columns}
                  />

                  {project && (
                    <Link
                      href={`/projects/${id}/settings/details`}
                      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground size-8"
                      aria-label="Project settings"
                    >
                      <Settings className="size-4" />
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            <Hash className="size-3 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/60 font-mono">
              {id}
            </span>
            <CopyButton value={id} />
          </div>

          {projectLoading ? (
            <div className="mt-2 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-20" />
            </div>
          ) : (
            project?.description && (
              <div className="text-sm text-muted-foreground mt-2">
                <CollapsibleDescription value={project.description} />
              </div>
            )
          )}

          {costStats && (
            <ProjectCostStats
              inputTokens={costStats.inputTokens}
              outputTokens={costStats.outputTokens}
              costUsd={costStats.costUsd}
            />
          )}
        </div>

        <Separator />

        {/* Kanban area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-x-auto px-6">
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
            <div className="flex-1 min-h-0 bg-background">
              <KanbanBoard tasks={tasks} projectId={id} columns={columns} />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
