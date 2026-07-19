"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { getToolDisplayBlock } from "./tool-display";
import { ToolDisplayBlockView } from "./ToolDisplayBlockView";
import type { ContentBlock } from "@/lib/agent-content";

interface ToolUseBlockProps {
  block: Extract<ContentBlock, { kind: "tool_use" }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolUseBlock({ block, open, onOpenChange }: ToolUseBlockProps) {
  const inputPreview = Object.keys(block.input).slice(0, 2).join(", ");
  const displayBlock = getToolDisplayBlock(block);

  return (
    <div className="border-l-2 border-violet-500/20 pl-2 my-1">
      <button
        onClick={() => onOpenChange(!open)}
        className="text-xs text-violet-400/70 hover:text-violet-300/90 transition-colors flex items-center gap-1.5 font-mono"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className="text-violet-400/80">⚙</span>
        <span>{block.name}</span>
        {!open && inputPreview && <span className="text-muted-foreground/40">({inputPreview}…)</span>}
      </button>
      {open && (
        displayBlock ? (
          <ToolDisplayBlockView block={displayBlock} />
        ) : (
          <pre className="mt-1 text-xs text-muted-foreground/60 bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )
      )}
    </div>
  );
}