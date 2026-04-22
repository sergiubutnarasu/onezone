'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Trash2, Clock, Wifi, WifiOff } from 'lucide-react';
import { fetchAgents, deleteAgent } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Agent } from '@onezone/shared';

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

export default function AgentsPage() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (agentId: string) => deleteAgent(agentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });

  function handleDelete(agent: Agent) {
    if (confirm(`Delete agent "${agent.name}"? This will disconnect it if connected.`)) {
      deleteMutation.mutate(agent.id);
    }
  }

  return (
    <TooltipProvider>
      <div className="p-8 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connected agents that can execute tasks
          </p>
        </div>

        {/* Agent list */}
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
                <p className="font-medium text-sm">No agents registered</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start an agent with{' '}
                  <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">
                    pnpm dev listen --name &quot;My Agent&quot;
                  </code>
                </p>
              </div>
            </div>
          ) : (
            agents.map((agent) => (
              <Card key={agent.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: agent info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 flex items-center justify-center size-8 rounded-md shrink-0 ${agent.isConnected ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                        {agent.isConnected
                          ? <Wifi className="size-4 text-emerald-500" />
                          : <WifiOff className="size-4 text-muted-foreground" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{agent.hostname}</p>
                        <p className="text-[11px] text-muted-foreground/60 font-mono mt-1 truncate">{agent.id}</p>
                        {agent.lastSeenAt && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Clock className="size-3 text-muted-foreground/60" />
                            <span className="text-[11px] text-muted-foreground/60">
                              {new Date(agent.lastSeenAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge
                        variant={agent.isConnected ? 'default' : 'secondary'}
                        className={agent.isConnected ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : ''}
                      >
                        <span className={`size-1.5 rounded-full mr-1.5 ${agent.isConnected ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                        {agent.isConnected ? 'Connected' : 'Disconnected'}
                      </Badge>

                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-flex" />}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(agent)}
                            disabled={
                              (deleteMutation.isPending && deleteMutation.variables === agent.id) ||
                              (agent.pendingTaskCount ?? 0) > 0
                            }
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {(agent.pendingTaskCount ?? 0) > 0
                            ? `${agent.pendingTaskCount} pending task(s) — reassign first`
                            : 'Delete agent'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
