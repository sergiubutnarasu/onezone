import { Hash } from "lucide-react";

interface ProjectCostStatsProps {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function ProjectCostStats({
  inputTokens,
  outputTokens,
  costUsd,
}: ProjectCostStatsProps) {
  if (inputTokens === 0 && outputTokens === 0 && costUsd === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-1.5">
        Usage &amp; Cost
      </p>
      <div className="flex flex-wrap gap-2">
        <div className="rounded-md border border-sky-500/15 bg-card px-3 py-1.5 flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-sky-400 uppercase font-semibold tracking-wider">
            <Hash className="size-3" />
            Input
          </div>
          <div className="text-xs font-mono font-medium text-foreground">
            {inputTokens.toLocaleString()}
          </div>
        </div>

        <div className="rounded-md border border-violet-500/15 bg-card px-3 py-1.5 flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-violet-400 uppercase font-semibold tracking-wider">
            <Hash className="size-3" />
            Output
          </div>
          <div className="text-xs font-mono font-medium text-foreground">
            {outputTokens.toLocaleString()}
          </div>
        </div>

        <div className="rounded-md border border-emerald-500/15 bg-card px-3 py-1.5 flex items-center gap-2">
          <div className="text-[10px] text-emerald-400 uppercase font-semibold tracking-wider">
            Cost
          </div>
          <div className="text-xs font-mono font-medium text-foreground">
            ${costUsd.toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  );
}
