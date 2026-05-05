"use client";

import type { RoomMessage } from "@/hooks/useTaskRoom";
import { parseClaudeLine, type ContentBlock } from "@/lib/claude-content";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface CommandGroupData {
  jobId: string;
  command: string;
  terminalName?: string | null;
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
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground/80 shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground/80 shrink-0" />
        )}
        <span className="text-amber-500 dark:text-amber-400/80 font-mono text-xs truncate flex-1">
          $ {group.command}
        </span>
        <span className="text-muted-foreground/60 text-xs shrink-0">
          {startTime}
        </span>
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
      </button>

      {/* Output lines */}
      {open && group.lines.length > 0 && (
        <div className="bg-background/80 py-2 px-3 space-y-1">
          {group.lines.map((msg, i) => {
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
            return <ClaudeOutputLine key={msg.id || i} content={msg.content} />;
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

/** Strip leading line numbers added by Claude's file-reading tool (e.g. "1 # Heading" → "# Heading") */
function stripLineNumbers(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\d+ /, ''))
    .join('\n');
}

function ClaudeOutputLine({ content }: { content: string }) {
  const blocks = parseClaudeLine(content);

  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <>
      {blocks.map((block, i) => (
        <ContentBlockView key={i} block={block} />
      ))}
    </>
  );
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripLineNumbers(block.text)}</ReactMarkdown>
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
