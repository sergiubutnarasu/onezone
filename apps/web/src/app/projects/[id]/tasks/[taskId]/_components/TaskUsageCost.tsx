import { Hash } from "lucide-react";

interface TaskUsageCostProps {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export function TaskUsageCost({
  inputTokens,
  outputTokens,
  costUsd,
}: TaskUsageCostProps) {
  if (inputTokens == null && outputTokens == null && costUsd == null)
    return null;

  return (
    <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
      <label className="px-3 pt-1.5 pb-0.5 md:px-5 md:pt-4 md:pb-2 text-[10px] md:text-[11px] text-muted-foreground uppercase font-semibold tracking-wide block">
        Usage &amp; Cost
      </label>
      <div className="px-3 pb-1.5 md:px-5 md:pb-4 grid grid-cols-3 gap-1.5 md:gap-3">
        <div className="rounded border border-sky-500/15 bg-card px-1.5 py-1 md:rounded-md md:px-3 md:py-2.5">
          <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-sky-400 uppercase font-semibold tracking-wider mb-0.5 md:mb-1.5">
            <Hash className="size-2.5 md:size-3" />
            <span className="hidden sm:inline">Input tokens</span>
            <span className="sm:hidden">In</span>
          </div>
          <div className="text-[11px] md:text-sm font-mono font-medium text-foreground">
            {inputTokens?.toLocaleString() ?? "—"}
          </div>
        </div>

        <div className="rounded border border-violet-500/15 bg-card px-1.5 py-1 md:rounded-md md:px-3 md:py-2.5">
          <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-violet-400 uppercase font-semibold tracking-wider mb-0.5 md:mb-1.5">
            <Hash className="size-2.5 md:size-3" />
            <span className="hidden sm:inline">Output tokens</span>
            <span className="sm:hidden">Out</span>
          </div>
          <div className="text-[11px] md:text-sm font-mono font-medium text-foreground">
            {outputTokens?.toLocaleString() ?? "—"}
          </div>
        </div>

        <div className="rounded border border-emerald-500/15 bg-card px-1.5 py-1 md:rounded-md md:px-3 md:py-2.5">
          <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-emerald-400 uppercase font-semibold tracking-wider mb-0.5 md:mb-1.5">
            Cost
          </div>
          <div className="text-[11px] md:text-sm font-mono font-medium text-foreground">
            ${costUsd !== null ? costUsd.toFixed(6) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
