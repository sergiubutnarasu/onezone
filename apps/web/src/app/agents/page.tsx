'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Pencil, Save, X } from 'lucide-react';
import { fetchAgents, updateAgent } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Agent } from '@/lib/api';
import { useState } from 'react';

function AgentSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </CardContent>
    </Card>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [model, setModel] = useState(agent.model);

  const mutation = useMutation({
    mutationFn: (data: { model: string }) => updateAgent(agent.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setEditing(false);
    },
  });

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{agent.name}</p>
              <p className="text-xs text-muted-foreground truncate">{agent.tag}</p>
              <div className="flex items-center gap-2 mt-2">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="h-7 text-xs w-48"
                      autoFocus
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => mutation.mutate({ model })}
                      disabled={mutation.isPending || !model}
                      className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Save className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(false);
                        setModel(agent.model);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {agent.model}
                    </code>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setEditing(true)}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          />
                        }
                      >
                        <Pencil className="size-3" />
                      </TooltipTrigger>
                      <TooltipContent>Edit model</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });

  return (
    <TooltipProvider>
      <div className="p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage agent configurations
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            <>
              <AgentSkeleton />
              <AgentSkeleton />
            </>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="flex items-center justify-center size-12 rounded-xl bg-muted">
                <Bot className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">No agents configured</p>
              </div>
            </div>
          ) : (
            agents.map((agent) => <AgentRow key={agent.id} agent={agent} />)
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
