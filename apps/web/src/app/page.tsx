'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, FolderOpen, ArrowUpRight, Calendar, Layers } from 'lucide-react';
import { fetchProjects, createProject } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [open, setOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const createMutation = useMutation({
    mutationFn: () => createProject({ name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setName('');
      setDescription('');
      setOpen(false);
    },
  });

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your agent task projects
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus data-icon="inline-start" />
            New Project
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <Input
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <Input
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending}
                className="w-full mt-1"
              >
                {createMutation.isPending ? 'Creating…' : 'Create project'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
              <p className="text-xs text-muted-foreground mt-1">Create your first project to get started</p>
            </div>
          </div>
        ) : (
          projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block group">
              <Card className="border-border/50 hover:border-primary/40 overflow-hidden transition-all duration-200 hover:shadow-md hover:shadow-primary/5">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="flex-1 p-5 min-w-0">
                      <div className="flex items-start gap-3">
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
                          {p.description ? (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {p.description}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground/40 mt-1 italic">No description</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          {formatDate(p.createdAt)}
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
  );
}
