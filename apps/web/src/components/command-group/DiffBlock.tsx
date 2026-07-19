import { DiffLines } from "./DiffLines";

export function DiffBlock({ diff, title }: { diff: string; title?: string }) {
  return (
    <div className="my-1 overflow-hidden rounded-md border border-border/70 bg-background/90 font-mono text-xs">
      <div className="border-b border-border/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
        {title ?? "diff"}
      </div>
      <DiffLines diff={diff} />
    </div>
  );
}