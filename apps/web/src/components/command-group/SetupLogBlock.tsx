"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SetupLogBlockProps } from "./types";

export function SetupLogBlock({
  lines,
  expandSignal,
  expandDirection,
}: SetupLogBlockProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setOpen(expandDirection), 0);
    return () => clearTimeout(id);
  }, [expandSignal, expandDirection]);

  return (
    <div className="border-l-2 border-muted-foreground/20 pl-2 my-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-muted-foreground/50 italic hover:text-muted-foreground/80 transition-colors flex items-center gap-1"
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        Project initialization...
      </button>
      {open && (
        <div className="text-xs text-muted-foreground/60 italic mt-1 whitespace-pre-wrap leading-relaxed space-y-0.5">
          {lines.map((msg, i) => (
            <div key={msg.id || i} className="font-mono">
              {msg.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
