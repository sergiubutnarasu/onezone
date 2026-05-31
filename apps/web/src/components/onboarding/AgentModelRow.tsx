"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateAgent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Save, X } from "lucide-react";
import type { Agent } from "@/lib/api";

interface AgentModelRowProps {
  agent: Agent;
}

export function AgentModelRow({ agent }: AgentModelRowProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [model, setModel] = useState(agent.model);

  const mutation = useMutation({
    mutationFn: (data: { model: string }) => updateAgent(agent.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setEditing(false);
    },
  });

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-center justify-center size-7 rounded-md bg-primary/10 shrink-0">
        <Bot className="size-3.5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{agent.name}</p>
        <p className="text-xs text-muted-foreground truncate">{agent.tag}</p>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-7 text-xs w-44"
            autoFocus
          />
          <Button
            size="icon-sm"
            variant="default"
            onClick={() => mutation.mutate({ model })}
            disabled={mutation.isPending || !model}
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
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground max-w-40 truncate">
            {agent.model}
          </code>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
