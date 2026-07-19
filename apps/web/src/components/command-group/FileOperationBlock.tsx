import { FilePenLine, FilePlus2, FileText } from "lucide-react";
import { DiffLines } from "./DiffLines";
import { MetadataGrid } from "./MetadataGrid";
import type { FileOperationBlockData } from "./types";

export function FileOperationBlock({
  operation,
  filePath,
  title,
  details,
  props,
  preview,
  diff,
}: FileOperationBlockData) {
  const Icon = operation === "read" ? FileText : operation === "write" ? FilePlus2 : FilePenLine;
  const propEntries = props ? Object.entries(props) : [];

  return (
    <div className="my-1 overflow-hidden rounded-md border border-border/70 bg-background/90">
      <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3" />
        <span className="font-medium text-foreground/80">{title}</span>
        {details.map((detail) => (
          <span key={detail} className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {detail}
          </span>
        ))}
      </div>
      {filePath && (
        <div className="border-b border-border/40 px-2.5 py-1.5 font-mono text-xs text-sky-800 dark:text-sky-300/90 break-all">
          {filePath}
        </div>
      )}
      {propEntries.length > 0 && (
        <div className="border-b border-border/40 p-2">
          <div className="mb-1 text-[11px] font-medium text-muted-foreground/70">properties</div>
          <MetadataGrid entries={propEntries} />
        </div>
      )}
      {diff ? (
        <DiffLines diff={diff} />
      ) : preview ? (
        <pre className="max-h-64 overflow-auto p-2.5 text-xs leading-relaxed text-muted-foreground/80">
          <code>{preview}</code>
        </pre>
      ) : null}
    </div>
  );
}