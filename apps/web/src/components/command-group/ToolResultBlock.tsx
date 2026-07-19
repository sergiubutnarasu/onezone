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
          className="agent-markdown mt-1 prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed
          prose-p:my-0.5 prose-pre:text-xs prose-code:text-xs"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripLineNumbers(text)}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}