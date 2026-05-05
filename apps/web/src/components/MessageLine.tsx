import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RoomMessage } from '@/hooks/useTaskRoom';

export function MessageLine({ message }: { message: RoomMessage }) {
  const isAgent = message.role === 'terminal';
  const isSystem = message.role === 'system';
  const isStderr = message.stream === 'stderr';

  const timestamp = new Date(message.ts).toLocaleTimeString();

  if (isSystem) {
    const hasExitCode = message.exitCode != null;
    const isSuccess = message.exitCode === 0;

    return (
      <div className="text-xs text-muted-foreground/60 italic py-0.5 px-4 flex items-center gap-2">
        <span className="text-muted-foreground/40 not-italic">{timestamp}</span>
        {hasExitCode ? (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium not-italic ${
              isSuccess
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}
          >
            {isSuccess ? '✔ Done' : `✖ Error (${message.exitCode})`}
          </span>
        ) : (
          <span className="text-muted-foreground/40">▶</span>
        )}
        {(message.terminalName || message.terminalId) && (
          <span className="text-muted-foreground/60 not-italic font-medium">
            {message.terminalName || message.terminalId}
          </span>
        )}
        <span className="font-mono">{message.content}</span>
      </div>
    );
  }

  if (isAgent) {
    return (
      <div
        className={`font-mono text-xs py-0.5 px-4 leading-relaxed ${
          isStderr ? 'text-rose-400/80 bg-rose-500/5' : 'text-emerald-300/80'
        }`}
      >
        <span className="text-muted-foreground/40 mr-2">{timestamp}</span>
        <span className="text-amber-400/70 mr-2">[{message.terminalName || message.terminalId}]</span>
        {message.content}
      </div>
    );
  }

  // user message
  return (
    <div className="py-1 px-4 flex items-baseline gap-2">
      <span className="text-muted-foreground/40 text-xs shrink-0">{timestamp}</span>
      <span className="text-primary font-semibold text-xs shrink-0">you</span>
      <div className="prose prose-sm prose-invert max-w-none text-foreground/90 text-sm leading-relaxed
        prose-p:my-0 prose-pre:bg-muted/60 prose-pre:text-xs prose-code:text-xs
        prose-code:bg-muted/60 prose-code:px-1 prose-code:rounded">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}
