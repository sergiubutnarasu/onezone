"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Square } from "lucide-react";
import { SetupLogBlock } from "./SetupLogBlock";
import { AgentOutputLine } from "./AgentOutputLine";
import { CommandGroupMetadata } from "./CommandGroupMetadata";
import { getDisplayCommand, groupSetupLines } from "./utils";
import type { CommandGroupProps } from "./types";

export function CommandGroup({ group, onStop }: CommandGroupProps) {
  const [open, setOpen] = useState(false);
  const [expandSignal, setExpandSignal] = useState(0);
  const [expandDirection, setExpandDirection] = useState(false);

  const isDone = group.exitCode !== undefined;
  const failed = isDone && group.exitCode !== 0;
  const startTime = new Date(group.startTs).toLocaleTimeString();

  return (
    <div className="border border-border/70 rounded-md mx-4 my-1.5 overflow-hidden bg-muted/30">
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) =>
          e.key === "Enter" || e.key === " " ? setOpen((o) => !o) : undefined
        }
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 text-left transition-colors cursor-pointer"
      >
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground/80 shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground/80 shrink-0" />
        )}
        <span className="text-amber-500 dark:text-amber-400/80 font-mono text-xs truncate flex-1">
          {getDisplayCommand(group.command)}
        </span>
        {(group.agentName || group.model) && (
          <span className="text-muted-foreground/50 text-[11px] shrink-0 truncate max-w-40">
            {[group.agentName, group.model].filter(Boolean).join(" · ")}
          </span>
        )}
        <span className="text-muted-foreground/60 text-xs shrink-0">
          {startTime}
        </span>
        {!isDone && (
          <span className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-primary/60 text-xs">
              <Loader2 className="size-3 animate-spin" />
              running
            </span>
            {onStop && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStop(group.jobId);
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                title="Stop command"
              >
                <Square className="size-2.5 fill-current" />
                stop
              </button>
            )}
          </span>
        )}
        {isDone && (
          <span
            className={`text-[11px] shrink-0 px-1.5 py-0.5 rounded font-medium ${
              failed
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {group.exitCode === -1
              ? "✖ Interrupted"
              : failed
                ? `✖ Error (${group.exitCode})`
                : "✔ Done"}
          </span>
        )}
      </div>

      {/* Output lines */}
      {open && group.lines.length > 0 && (
        <div className="bg-background/80 py-2 px-3 space-y-1">
          <CommandGroupMetadata group={group} />
          <div className="flex justify-end gap-2 pb-1 border-b border-border/30 mb-1">
            <button
              onClick={() => {
                setExpandDirection(true);
                setExpandSignal((s) => s + 1);
              }}
              className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Expand all
            </button>
            <button
              onClick={() => {
                setExpandDirection(false);
                setExpandSignal((s) => s + 1);
              }}
              className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Collapse all
            </button>
          </div>
          {groupSetupLines(group.lines).map((item, i) => {
            if (item.kind === "setup") {
              return (
                <SetupLogBlock
                  key={i}
                  lines={item.lines}
                  expandSignal={expandSignal}
                  expandDirection={expandDirection}
                />
              );
            }
            const msg = item.msg;
            if (msg.stream === "stderr") {
              return (
                <div
                  key={msg.id || i}
                  className="font-mono text-xs text-rose-500 dark:text-rose-400/80 whitespace-pre-wrap leading-relaxed"
                >
                  {msg.content}
                </div>
              );
            }
            return (
              <AgentOutputLine
                key={msg.id || i}
                content={msg.content}
                expandSignal={expandSignal}
                expandDirection={expandDirection}
              />
            );
          })}
        </div>
      )}

      {open && group.lines.length === 0 && isDone && (
        <div className="bg-background/80 py-2 space-y-2">
          <CommandGroupMetadata group={group} />
          <div className="px-3 text-xs text-muted-foreground/60 italic">
            no output
          </div>
        </div>
      )}
    </div>
  );
}
