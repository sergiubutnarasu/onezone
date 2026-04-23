import type { ConnectedTerminal } from '@/hooks/useTaskRoom';

export function TerminalStatusBar({ terminals }: { terminals: ConnectedTerminal[] }) {
  if (terminals.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/50 px-4 py-1.5 border-b border-border/40 flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-muted-foreground/30" />
        No terminals in room
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/40 text-xs">
      <span className="text-muted-foreground/60">In room:</span>
      {terminals.map((t) => (
        <span
          key={t.terminalId}
          className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          {t.terminalName}
        </span>
      ))}
    </div>
  );
}
