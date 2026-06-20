"use client";

import { CopyButton } from "@/components/CopyButton";
import { CreateProjectButton } from "@/components/CreateProjectButton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fetchAgents, fetchProjects, fetchTerminals } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Calendar, FolderOpen, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function ProjectCardSkeleton() {
  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          <div className="w-1 bg-muted" />
          <div className="flex-1 p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-72 mt-2" />
            <div className="mt-4 pt-3 border-t border-border/30">
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectsPage() {
  const router = useRouter();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const { data: terminals = [], isLoading: isLoadingTerminals } = useQuery({
    queryKey: ["terminals"],
    queryFn: fetchTerminals,
  });

  // Redirect to dedicated onboarding flow when the user has no terminals and
  // no projects yet (fresh install).
  const dataReady = !isLoading && !isLoadingTerminals;
  const shouldRedirect =
    dataReady && projects.length === 0 && terminals.length === 0;
  useEffect(() => {
    if (shouldRedirect) {
      router.replace("/onboarding");
    }
  }, [shouldRedirect, router]);

  if (shouldRedirect) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="p-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-display text-balance">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Manage your terminal task projects
            </p>
          </div>

          <CreateProjectButton agents={agents} terminals={terminals} />
        </div>

        {/* Project list */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <>
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
            </>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="flex items-center justify-center size-12 rounded-xl bg-muted">
                <FolderOpen className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">No projects yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first project to get started
                </p>
              </div>
            </div>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block group"
              >
                <Card className="border-border/50 hover:border-primary/40 overflow-hidden transition-all duration-200 hover:shadow-md hover:shadow-primary/5">
                  <CardContent className="p-0">
                    <div className="flex">
                      <div className="flex-1 p-5 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 flex items-center justify-center size-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                            <Layers className="size-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-sm tracking-tight group-hover:text-primary transition-colors truncate">
                                {p.name}
                              </h3>
                              <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-y-0.5 translate-x-0.5 group-hover:translate-y-0 group-hover:translate-x-0 transition-all shrink-0" />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            {formatDate(p.createdAt)}
                          </span>
                          <span
                            className="flex items-center gap-1"
                            onClick={(e) => e.preventDefault()}
                          >
                            <span className="text-xs text-muted-foreground font-mono">
                              {p.id}
                            </span>
                            <CopyButton value={p.id} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
