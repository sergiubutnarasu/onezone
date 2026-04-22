import type { RoomMessage } from '@/hooks/useTaskRoom';

export function MessageLine({ message }: { message: RoomMessage }) {
  const isAgent = message.role === 'agent';
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
        {(message.agentName || message.agentId) && (
          <span className="text-muted-foreground/60 not-italic font-medium">
            {message.agentName || message.agentId}
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
        <span className="text-amber-400/70 mr-2">[{message.agentName || message.agentId}]</span>
        {message.content}
      </div>
    );
  }

  // user message
  return (
    <div className="py-1 px-4 flex items-baseline gap-2">
      <span className="text-muted-foreground/40 text-xs shrink-0">{timestamp}</span>
      <span className="text-primary font-semibold text-xs shrink-0">you</span>
      <span className="text-foreground/90 text-sm">{message.content}</span>
    </div>
  );
}
