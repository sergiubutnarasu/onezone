import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function TextBlock({ text }: { text: string }) {
  return (
    <div
      className="prose prose-sm prose-invert max-w-none text-muted-foreground text-sm leading-relaxed
      prose-p:my-1 prose-pre:bg-muted/60 prose-pre:text-xs prose-code:text-xs
      prose-code:bg-muted/60 prose-code:px-1 prose-code:rounded prose-headings:my-1"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}