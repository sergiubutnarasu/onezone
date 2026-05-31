"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTerminals } from "@/lib/api";
import { API_BASE } from "@/lib/http-client";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { Check } from "lucide-react";

interface ConnectTerminalStepProps {
  onNext: () => void;
}

export function ConnectTerminalStep({ onNext }: ConnectTerminalStepProps) {
  const { data: terminals = [] } = useQuery({
    queryKey: ["terminals"],
    queryFn: fetchTerminals,
    refetchInterval: 3000,
  });

  const connected = terminals.length > 0;

  const npxLoginCommand = `npx -y -p @onezone/terminal onezone-terminal login --server ${API_BASE}`;
  const npxListenCommand = `npx -y -p @onezone/terminal onezone-terminal listen --server ${API_BASE} --name "My Terminal"`;

  const dockerCommand = [
    "ANTHROPIC_API_KEY=<your-api-key> \\",
    '  TERMINAL_NAME="My Terminal" \\',
    "  docker compose run --rm terminal",
  ].join("\n");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Connect a terminal</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Terminals are agents that run on your machine (or in Docker) and
          execute tasks. Start one with the command below.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Option A — npm
        </p>
        <p className="text-xs text-muted-foreground">
          1. Authenticate (follow the printed URL and code):
        </p>
        <CommandBlock command={npxLoginCommand} />
        <p className="text-xs text-muted-foreground">
          2. Start the terminal:
        </p>
        <CommandBlock command={npxListenCommand} />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Option B — Docker Compose
        </p>
        <p className="text-xs text-muted-foreground">
          From the repo root. The container will prompt for device-flow login on
          first run.
        </p>
        <CommandBlock command={dockerCommand} />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <TerminalStatus connected={connected} />
        <Button onClick={onNext} disabled={!connected}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="relative rounded-lg bg-muted p-3">
      <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all pr-8">
        {command}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={command} />
      </div>
    </div>
  );
}

function TerminalStatus({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="flex items-center justify-center size-5 rounded-full bg-green-500/20">
          <Check className="size-3 text-green-500" />
        </span>
        <span className="text-green-600 dark:text-green-400 font-medium">
          Terminal connected!
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex size-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full size-2 bg-amber-500" />
      </span>
      <span className="text-muted-foreground">Waiting for terminal…</span>
    </div>
  );
}
