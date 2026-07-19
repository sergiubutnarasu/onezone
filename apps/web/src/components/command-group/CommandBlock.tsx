"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clipboard, Terminal } from "lucide-react";
import { MetadataGrid } from "./MetadataGrid";

export function CommandBlock({
  command,
  title,
  props,
  expandSignal,
  expandDirection,
}: {
  command: string;
  title?: string;
  props?: Record<string, unknown>;
  expandSignal?: number;
  expandDirection?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const propEntries = props ? Object.entries(props) : [];
  const firstLine = command.split("\n").find((line) => line.trim())?.trim() ?? "command";

  useEffect(() => {
    if (expandSignal === undefined || expandDirection === undefined) return;
    const id = setTimeout(() => setOpen(expandDirection), 0);
    return () => clearTimeout(id);
  }, [expandSignal, expandDirection]);

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="my-1 overflow-hidden rounded-md border border-border/70 bg-muted/60 dark:border-amber-500/20 dark:bg-zinc-950/80">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) =>
          event.key === "Enter" || event.key === " "
            ? setOpen((value) => !value)
            : undefined
        }
        className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground dark:border-white/10 dark:text-amber-300/80 cursor-pointer"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Terminal className="size-3" />
        <span className="font-medium shrink-0">{title ?? "command"}</span>
        <span className="truncate text-foreground dark:text-emerald-100">{firstLine}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void copyCommand();
          }}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
        >
          <Clipboard className="size-3" />
          {copied ? "copied" : "copy"}
        </button>
      </div>
      {open && (
        <pre className="overflow-x-auto p-2.5 text-xs leading-relaxed text-foreground dark:text-emerald-100">
          <code>{command}</code>
        </pre>
      )}
      {open && propEntries.length > 0 && (
        <div className="border-t border-border/60 p-2 dark:border-white/10">
          <MetadataGrid entries={propEntries} tone="amber" />
        </div>
      )}
    </div>
  );
}