import { ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { stripLineNumbers } from "./utils";

interface ToolResultBlockProps {
  text: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolResultBlock({ text, open, onOpenChange }: ToolResultBlockProps) {
  return (
    <div className="border-l-2 border-muted-foreground/20 pl-2 my-1">
      <button
        onClick={() => onOpenChange(!open)}
        className="text-xs text-muted-foreground/50 italic hover:text-muted-foreground/80 transition-colors flex items-center gap-1"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        result
      </button>
      {open && (
        <div
          className="mt-1 prose prose-sm prose-invert max-w-none text-muted-foreground/70 text-xs leading-relaxed
          prose-p:my-0.5 prose-pre:bg-muted/40 prose-pre:text-xs prose-code:text-xs
          prose-code:bg-muted/40 prose-code:px-1 prose-code:rounded"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripLineNumbers(text)}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}