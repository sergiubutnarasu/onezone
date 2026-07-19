"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Home,
  Settings,
  MoreHorizontal,
  Download,
  Trash2,
  Hash,
} from "lucide-react";
import { fetchProject, exportProject, deleteProject } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";

const TABS = [
  { label: "Details", value: "details", href: "details" },
  { label: "Skills", value: "skills", href: "skills" },
  { label: "Memory", value: "memory", href: "memory" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
  });

  const activeTab =
    TABS.find((t) => pathname.endsWith(`/settings/${t.href}`))?.value ?? "details";

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      router.push("/");
    },
  });

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    try {
      const config = await exportProject(project.id);
      const blob = new Blob([JSON.stringify(config, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-config.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-2">
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
          <Link
            href={`/projects/${id}`}
            className="hover:text-foreground transition-colors"
          >
            {isLoading ? (
              <Skeleton className="h-3 w-24 inline-block" />
            ) : (
              project?.name
            )}
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-foreground flex items-center gap-1">
            <Settings className="size-3" />
            Settings
          </span>
        </div>

        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-display text-balance truncate">
              {isLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                "Project settings"
              )}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <Hash className="size-3 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/60 font-mono">
                {id}
              </span>
              <CopyButton value={id} />
            </div>
          </div>

          {/* More actions dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <MoreHorizontal className="size-4" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleExport}
                  disabled={exporting || isLoading}
                  className="gap-2"
                >
                  <Download className="size-4" />
                  {exporting ? "Exporting…" : "Export configuration"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteMutation.isPending}
                  className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const tab = TABS.find((t) => t.value === value);
            if (tab) router.push(`/projects/${id}/settings/${tab.href}`);
          }}
        >
          <TabsList variant="line">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-initial px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Separator />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete project"
        description={`This will permanently delete “${project?.name ?? "this project"}” and all of its data. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
      />

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-h-0",
          activeTab === "memory"
            ? "overflow-y-auto md:overflow-hidden"
            : "overflow-y-auto px-8 py-6",
        )}
      >
        {children}
      </div>
    </div>
  );
}
