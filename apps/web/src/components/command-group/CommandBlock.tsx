"use client";

import { useState } from "react";
import { Clipboard, Terminal } from "lucide-react";
import { MetadataGrid } from "./MetadataGrid";

export function CommandBlock({ command, title, props }: { command: string; title?: string; props?: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const propEntries = props ? Object.entries(props) : [];

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="my-1 overflow-hidden rounded-md border border-amber-500/20 bg-zinc-950/80">
      <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-1.5 text-[11px] text-amber-300/80">
        <Terminal className="size-3" />
        <span className="font-medium">{title ?? "command"}</span>
        <button
          type="button"
          onClick={copyCommand}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
        >
          <Clipboard className="size-3" />
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-2.5 text-xs leading-relaxed text-emerald-200">
        <code>{command}</code>
      </pre>
      {propEntries.length > 0 && (
        <div className="border-t border-white/10 p-2">
          <MetadataGrid entries={propEntries} tone="amber" />
        </div>
      )}
    </div>
  );
}