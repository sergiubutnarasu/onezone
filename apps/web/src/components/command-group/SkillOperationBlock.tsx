import { Blocks } from "lucide-react";
import { MetadataGrid } from "./MetadataGrid";
import type { SkillOperationBlockData } from "./types";

export function SkillOperationBlock({
  title,
  skillName,
  source,
  mode,
  command,
  details,
  args,
  props,
}: SkillOperationBlockData) {
  const propertyEntries = Object.entries({ ...(args ?? {}), ...(props ?? {}) });

  return (
    <div className="my-1 overflow-hidden rounded-md border border-cyan-600/30 bg-cyan-50/80 dark:border-cyan-500/20 dark:bg-cyan-500/5">
      <div className="flex items-center gap-2 border-b border-cyan-600/30 px-2.5 py-1.5 text-[11px] text-cyan-800 dark:border-cyan-500/20 dark:text-cyan-200/80">
        <Blocks className="size-3" />
        <span className="font-medium text-cyan-900 dark:text-cyan-100/90">{title}</span>
        {mode && (
          <span className="rounded bg-cyan-200/70 px-1.5 py-0.5 font-mono text-[10px] text-cyan-900 dark:bg-cyan-400/10 dark:text-cyan-200/80">
            {mode}
          </span>
        )}
        {details.map((detail) => (
          <span key={detail} className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {detail}
          </span>
        ))}
      </div>
      <div className="space-y-1 px-2.5 py-2 text-xs">
        {skillName && (
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">skill</span>
            <span className="font-mono text-cyan-900 dark:text-cyan-100/90 break-all">{skillName}</span>
          </div>
        )}
        {source && (
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">source</span>
            <span className="font-mono text-muted-foreground break-all">{source}</span>
          </div>
        )}
        {propertyEntries.length > 0 && (
          <div className="pt-1">
            <div className="mb-1 text-[11px] font-medium text-muted-foreground/70">properties</div>
            <MetadataGrid entries={propertyEntries} tone="cyan" />
          </div>
        )}
        {command && (
          <pre className="mt-2 overflow-x-auto rounded border border-cyan-600/30 bg-background/80 p-2 font-mono text-[11px] text-cyan-950 dark:border-cyan-500/20 dark:bg-background/70 dark:text-cyan-100/80">
            <code>{command}</code>
          </pre>
        )}
      </div>
    </div>
  );
}