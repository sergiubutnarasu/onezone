'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { RoomMessage } from '@/hooks/useTaskRoom';

export interface CommandGroupData {
  jobId: string;
  command: string;
  agentName?: string | null;
  startTs: number;
  exitCode?: number;
  lines: RoomMessage[];
}

export function CommandGroup({ group }: { group: CommandGroupData }) {
  const [open, setOpen] = useState(true);

  const isDone = group.exitCode !== undefined;
  const failed = isDone && group.exitCode !== 0;
  const startTime = new Date(group.startTs).toLocaleTimeString();

  return (
    <div className="border border-border/70 rounded-md mx-4 my-1.5 overflow-hidden bg-muted/30">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 text-left transition-colors"
      >
        {open
          ? <ChevronDown className="size-3 text-muted-foreground/80 shrink-0" />
          : <ChevronRight className="size-3 text-muted-foreground/80 shrink-0" />
        }
        <span className="text-amber-500 dark:text-amber-400/80 font-mono text-xs truncate flex-1">
          $ {group.command}
        </span>
        <span className="text-muted-foreground/60 text-xs shrink-0">{startTime}</span>
        {!isDone && (
          <span className="flex items-center gap-1 text-primary/70 text-xs shrink-0">
            <Loader2 className="size-3 animate-spin" />
            running
          </span>
        )}
        {isDone && (
          <span
            className={`text-[11px] shrink-0 px-1.5 py-0.5 rounded font-medium ${
              failed
                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {group.exitCode === -1 ? '✖ Interrupted' : failed ? `✖ Error (${group.exitCode})` : '✔ Done'}
          </span>
        )}
      </button>

      {/* Output lines */}
      {open && group.lines.length > 0 && (
        <div className="bg-background/80 py-1">
          {group.lines.map((msg, i) => {
            const isStderr = msg.stream === 'stderr';
            return (
              <div
                key={msg.id || i}
                className={`font-mono text-xs px-3 py-0.5 whitespace-pre-wrap leading-relaxed ${
                  isStderr ? 'text-rose-500 dark:text-rose-400/80' : 'text-emerald-600 dark:text-emerald-300/80'
                }`}
              >
                {msg.content}
              </div>
            );
          })}
        </div>
      )}

      {open && group.lines.length === 0 && isDone && (
        <div className="bg-background/80 px-3 py-2 text-xs text-muted-foreground/60 italic">
          no output
        </div>
      )}
    </div>
  );
}
