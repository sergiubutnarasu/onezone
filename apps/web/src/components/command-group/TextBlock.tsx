import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function TextBlock({ text }: { text: string }) {
  return (
    <div
      className="agent-markdown prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
      prose-p:my-1 prose-pre:text-xs prose-code:text-xs prose-headings:my-1"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}