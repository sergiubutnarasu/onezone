"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProjectStatistics } from "@/lib/api";
import type { ProjectStatisticsRow, ProjectStatisticsSummary } from "@onezone/shared";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDollarSign, Hash, XCircle } from "lucide-react";
import Link from "next/link";

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatCurrency(value: number) {
  return `$${value.toFixed(6)}`;
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <Card className="border-border/60" size="sm">
      <CardHeader className="grid-cols-[1fr_auto] items-center gap-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tracking-tight">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function SummaryCards({ summary }: { summary: ProjectStatisticsSummary }) {
  const totalJobs = summary.jobsSucceeded + summary.jobsFailed;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Tasks Done"
        value={formatNumber(summary.tasksDone)}
        detail={`${formatNumber(summary.totalTasks)} total tasks`}
        icon={CheckCircle2}
      />
      <StatCard
        title="Job Results"
        value={formatNumber(totalJobs)}
        detail={`${formatNumber(summary.jobsSucceeded)} succeeded, ${formatNumber(summary.jobsFailed)} failed`}
        icon={XCircle}
      />
      <StatCard
        title="Tokens"
        value={formatNumber(summary.inputTokens + summary.outputTokens)}
        detail={`${formatNumber(summary.inputTokens)} input, ${formatNumber(summary.outputTokens)} output`}
        icon={Hash}
      />
      <StatCard
        title="Cost"
        value={formatCurrency(summary.costUsd)}
        icon={CircleDollarSign}
      />
    </div>
  );
}

function ProjectRow({ project }: { project: ProjectStatisticsRow }) {
  const totalJobs = project.jobsSucceeded + project.jobsFailed;

  return (
    <Link href={`/projects/${project.projectId}`} className="block">
      <Card className="border-border/60 transition-colors hover:border-primary/40" size="sm">
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))] md:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{project.projectName}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {project.projectId}
              </p>
            </div>
            <Metric label="Tasks done" value={`${formatNumber(project.tasksDone)} / ${formatNumber(project.totalTasks)}`} />
            <Metric label="Jobs" value={formatNumber(totalJobs)} detail={`${formatNumber(project.jobsSucceeded)} ok, ${formatNumber(project.jobsFailed)} failed`} />
            <Metric label="Input" value={formatNumber(project.inputTokens)} />
            <Metric label="Output" value={formatNumber(project.outputTokens)} />
            <Metric label="Cost" value={formatCurrency(project.costUsd)} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-medium">{value}</p>
      {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function StatisticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <Card key={index} className="border-border/60" size="sm">
            <CardContent>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-4 h-7 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="border-border/60" size="sm">
            <CardContent>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-3 h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["project-statistics"],
    queryFn: fetchProjectStatistics,
  });

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Statistics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global task, job, token, and cost totals by project
        </p>
      </div>

      {isLoading || !data ? (
        <StatisticsSkeleton />
      ) : data.projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Hash className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No statistics yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a project and run tasks to collect usage data
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <SummaryCards summary={data.totals} />
          <div className="flex flex-col gap-3">
            {data.projects.map((project) => (
              <ProjectRow key={project.projectId} project={project} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}