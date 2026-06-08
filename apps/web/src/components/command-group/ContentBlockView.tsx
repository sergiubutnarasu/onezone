"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ContentBlock } from "@/lib/agent-content";
import { stripLineNumbers } from "./utils";
import type { ExpandableProps } from "./types";

interface ContentBlockViewProps extends ExpandableProps {
  block: ContentBlock;
}

export function ContentBlockView({
  block,
  expandSignal,
  expandDirection,
}: ContentBlockViewProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setThinkingOpen(expandDirection);
      setToolOpen(expandDirection);
      setResultOpen(expandDirection);
    }, 0);
    return () => clearTimeout(id);
  }, [expandSignal, expandDirection]);

  if (block.kind === "text") {
    return (
      <div
        className="prose prose-sm prose-invert max-w-none text-muted-foreground text-sm leading-relaxed
        prose-p:my-1 prose-pre:bg-muted/60 prose-pre:text-xs prose-code:text-xs
        prose-code:bg-muted/60 prose-code:px-1 prose-code:rounded prose-headings:my-1"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
      </div>
    );
  }

  if (block.kind === "thinking") {
    return (
      <div className="border-l-2 border-muted-foreground/20 pl-2 my-1">
        <button
          onClick={() => setThinkingOpen((o) => !o)}
          className="text-xs text-muted-foreground/50 italic hover:text-muted-foreground/80 transition-colors flex items-center gap-1"
        >
          {thinkingOpen ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          thinking…
        </button>
        {thinkingOpen && (
          <div className="text-xs text-muted-foreground/60 italic mt-1 whitespace-pre-wrap leading-relaxed">
            {block.text}
          </div>
        )}
      </div>
    );
  }

  if (block.kind === "tool_use") {
    const inputPreview = Object.keys(block.input).slice(0, 2).join(", ");
    return (
      <div className="border-l-2 border-violet-500/20 pl-2 my-1">
        <button
          onClick={() => setToolOpen((o) => !o)}
          className="text-xs text-violet-400/70 hover:text-violet-300/90 transition-colors flex items-center gap-1.5 font-mono"
        >
          {toolOpen ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          <span className="text-violet-400/80">⚙</span>
          <span>{block.name}</span>
          {!toolOpen && inputPreview && (
            <span className="text-muted-foreground/40">({inputPreview}…)</span>
          )}
        </button>
        {toolOpen && (
          <pre className="mt-1 text-xs text-muted-foreground/60 bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (block.kind === "tool_result") {
    return (
      <div className="border-l-2 border-muted-foreground/20 pl-2 my-1">
        <button
          onClick={() => setResultOpen((o) => !o)}
          className="text-xs text-muted-foreground/50 italic hover:text-muted-foreground/80 transition-colors flex items-center gap-1"
        >
          {resultOpen ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          result
        </button>
        {resultOpen && (
          <div
            className="mt-1 prose prose-sm prose-invert max-w-none text-muted-foreground/70 text-xs leading-relaxed
            prose-p:my-0.5 prose-pre:bg-muted/40 prose-pre:text-xs prose-code:text-xs
            prose-code:bg-muted/40 prose-code:px-1 prose-code:rounded"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripLineNumbers(block.text)}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  }

  // raw (non-JSON terminal output)
  return (
    <div className="font-mono text-xs text-emerald-600 dark:text-emerald-300/80 whitespace-pre-wrap leading-relaxed">
      {block.text}
    </div>
  );
}
