"use client";

import { Button } from "@/components/ui/button";
import { AgentModelRow } from "./AgentModelRow";
import type { Agent } from "@/types/agent";

interface ConfigureAgentsStepProps {
  agents: Agent[];
  onNext: () => void;
}

export function ConfigureAgentsStep({
  agents,
  onNext,
}: ConfigureAgentsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configure agents</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set the default model for each agent. This determines which AI model
          is used when executing tasks.
        </p>
      </div>

      <div className="space-y-2">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No agents found.
          </p>
        ) : (
          agents.map((agent) => <AgentModelRow key={agent.id} agent={agent} />)
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border/50">
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
