"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Pencil } from "lucide-react";
import { fetchAgents, updateAgent, updateGlobalAgent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Agent } from "@/lib/api";
import { useState } from "react";

type AgentWithModels = Agent & {
  defaultModel?: string;
  userModel?: string | null;
};

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

function AgentRow({ agent, isAdmin }: { agent: AgentWithModels; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<"user" | "global" | null>(null);
  const [userModel, setUserModel] = useState(agent.model);
  const [globalModel, setGlobalModel] = useState(agent.defaultModel ?? agent.model);

  const userMutation = useMutation({
    mutationFn: (data: { model: string }) => updateAgent(agent.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setEditing(null);
    },
  });

  const globalMutation = useMutation({
    mutationFn: (data: { model: string }) => updateGlobalAgent(agent.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setEditing(null);
    },
  });

  const resetEditing = () => {
    setEditing(null);
    setUserModel(agent.model);
    setGlobalModel(agent.defaultModel ?? agent.model);
  };

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
              <p className="text-xs text-muted-foreground truncate">
                {agent.tag}
              </p>
              <div className="flex flex-col gap-2 mt-2">
                {editing === "user" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={userModel}
                      onChange={(e) => setUserModel(e.target.value)}
                      className="h-7 text-xs w-48"
                      autoFocus
                    />

                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => userMutation.mutate({ model: userModel })}
                        disabled={userMutation.isPending || !userModel}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={resetEditing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Your model</span>
                    <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {agent.model}
                    </code>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setEditing("user")}
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
                {isAdmin && (
                  editing === "global" ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        value={globalModel}
                        onChange={(e) => setGlobalModel(e.target.value)}
                        className="h-7 text-xs w-48"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => globalMutation.mutate({ model: globalModel })}
                          disabled={globalMutation.isPending || !globalModel}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={resetEditing}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Global default</span>
                      <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {agent.defaultModel ?? agent.model}
                      </code>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => setEditing("global")}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted"
                            />
                          }
                        >
                          <Pencil className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>Edit global default</TooltipContent>
                      </Tooltip>
                    </div>
                  )
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
  const { user } = useAuth();
  const { data: agents = [], isLoading } = useQuery<AgentWithModels[]>({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  return (
    <TooltipProvider>
      <div className="p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-display text-balance">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
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
            agents.map((agent) => <AgentRow key={agent.id} agent={agent} isAdmin={user?.isAdmin === true} />)
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
