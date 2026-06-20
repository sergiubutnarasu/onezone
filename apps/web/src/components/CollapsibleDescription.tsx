"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { cn } from "@/lib/utils";
import { COLLAPSED_MAX_HEIGHT } from "@/constants";

interface CollapsibleDescriptionProps {
  value?: string | null;
  className?: string;
}

export function CollapsibleDescription({ value, className }: CollapsibleDescriptionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT + 4);
  }, [value]);

  if (!value) return null;

  return (
    <div className={cn(className)}>
      <div
        ref={contentRef}
        className="relative overflow-hidden transition-all duration-200"
        style={{ maxHeight: isExpanded ? "none" : `${COLLAPSED_MAX_HEIGHT}px` }}
      >
        <RichTextViewer value={value} />
      </div>

      {isOverflowing && (
        <button
          onClick={() => setIsExpanded((p) => !p)}
          className="mt-1 flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="size-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="size-3" /> Read more
            </>
          )}
        </button>
      )}
    </div>
  );
}
