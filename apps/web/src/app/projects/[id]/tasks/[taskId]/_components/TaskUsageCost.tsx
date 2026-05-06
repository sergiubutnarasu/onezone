import { Hash, DollarSign } from "lucide-react";

interface TaskUsageCostProps {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export function TaskUsageCost({ inputTokens, outputTokens, costUsd }: TaskUsageCostProps) {
  if (inputTokens == null && outputTokens == null && costUsd == null) return null;

  return (
    <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
      <label className="px-5 pt-4 pb-2 text-[11px] text-muted-foreground uppercase font-semibold tracking-wide block">
        Usage &amp; Cost
      </label>
      <div className="px-5 pb-4 grid grid-cols-3 gap-3">
        {inputTokens != null && (
          <div className="rounded-md border border-sky-500/15 bg-card px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-sky-400 uppercase font-semibold tracking-wider mb-1.5">
              <Hash className="size-3" />
              Input tokens
            </div>
            <div className="text-sm font-mono font-medium text-foreground">
              {inputTokens.toLocaleString()}
            </div>
          </div>
        )}
        {outputTokens != null && (
          <div className="rounded-md border border-violet-500/15 bg-card px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-violet-400 uppercase font-semibold tracking-wider mb-1.5">
              <Hash className="size-3" />
              Output tokens
            </div>
            <div className="text-sm font-mono font-medium text-foreground">
              {outputTokens.toLocaleString()}
            </div>
          </div>
        )}
        {costUsd != null && (
          <div className="rounded-md border border-emerald-500/15 bg-card px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 uppercase font-semibold tracking-wider mb-1.5">
              <DollarSign className="size-3" />
              Total cost
            </div>
            <div className="text-sm font-mono font-medium text-foreground">
              ${costUsd < 0.01 ? costUsd.toFixed(6) : costUsd.toFixed(4)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
