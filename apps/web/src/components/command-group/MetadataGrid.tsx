import { formatDisplayValue } from "./tool-display";

interface MetadataGridProps {
  entries: Array<[string, unknown]>;
  tone?: "default" | "amber" | "cyan";
}

export function MetadataGrid({ entries, tone = "default" }: MetadataGridProps) {
  const visibleEntries = entries.filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (visibleEntries.length === 0) return null;

  const valueClass = tone === "amber" ? "text-amber-100/80" : tone === "cyan" ? "text-cyan-100/80" : "text-muted-foreground/80";

  return (
    <div className="overflow-hidden rounded border border-border/40 bg-background/60">
      {visibleEntries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-border/30 last:border-b-0">
          <span className="border-r border-border/30 px-2 py-1 font-mono text-[11px] text-muted-foreground/60">
            {key}
          </span>
          <span className={`whitespace-pre-wrap wrap-break-word px-2 py-1 font-mono text-[11px] ${valueClass}`}>
            {formatDisplayValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}