'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Trash2, Clock, Wifi, WifiOff } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { fetchTerminals, deleteTerminal } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Terminal } from '@onezone/shared';

function TerminalSkeleton() {
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

export default function TerminalsPage() {
  const qc = useQueryClient();
  const { data: terminals = [], isLoading } = useQuery<Terminal[]>({
    queryKey: ['terminals'],
    queryFn: fetchTerminals,
    refetchInterval: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (terminalId: string) => deleteTerminal(terminalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terminals'] }),
  });

  function handleDelete(terminal: Terminal) {
    if (confirm(`Delete terminal "${terminal.name}"? This will disconnect it if connected.`)) {
      deleteMutation.mutate(terminal.id);
    }
  }

  return (
    <TooltipProvider>
      <div className="p-8 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Terminals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connected terminals that can execute tasks
          </p>
        </div>

        {/* Terminal list */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <>
              <TerminalSkeleton />
              <TerminalSkeleton />
            </>
          ) : terminals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="flex items-center justify-center size-12 rounded-xl bg-muted">
                <Bot className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">No terminals registered</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start a terminal with{' '}
                  <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">
                    pnpm dev listen --name &quot;My Terminal&quot;
                  </code>
                </p>
              </div>
            </div>
          ) : (
            terminals.map((terminal) => (
              <Card key={terminal.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: terminal info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 flex items-center justify-center size-8 rounded-md shrink-0 ${terminal.isConnected ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                        {terminal.isConnected
                          ? <Wifi className="size-4 text-emerald-500" />
                          : <WifiOff className="size-4 text-muted-foreground" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{terminal.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{terminal.hostname}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <p className="text-[11px] text-muted-foreground/60 font-mono truncate">{terminal.id}</p>
                          <CopyButton value={terminal.id} />
                        </div>
                        {terminal.lastSeenAt && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Clock className="size-3 text-muted-foreground/60" />
                            <span className="text-[11px] text-muted-foreground/60">
                              {new Date(terminal.lastSeenAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge
                        variant={terminal.isConnected ? 'default' : 'secondary'}
                        className={terminal.isConnected ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : ''}
                      >
                        <span className={`size-1.5 rounded-full mr-1.5 ${terminal.isConnected ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                        {terminal.isConnected ? 'Connected' : 'Disconnected'}
                      </Badge>

                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-flex" />}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(terminal)}
                            disabled={
                              deleteMutation.isPending && deleteMutation.variables === terminal.id
                            }
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Delete terminal
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
