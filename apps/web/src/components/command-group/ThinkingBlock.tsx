import { ChevronDown, ChevronRight } from "lucide-react";

interface ThinkingBlockProps {
  text: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThinkingBlock({ text, open, onOpenChange }: ThinkingBlockProps) {
  return (
    <div className="border-l-2 border-muted-foreground/20 pl-2 my-1">
      <button
        onClick={() => onOpenChange(!open)}
        className="text-xs text-muted-foreground/50 italic hover:text-muted-foreground/80 transition-colors flex items-center gap-1"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        thinking…
      </button>
      {open && (
        <div className="text-xs text-muted-foreground/60 italic mt-1 whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}