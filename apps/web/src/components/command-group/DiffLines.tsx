export function DiffLines({ diff }: { diff: string }) {
  return (
    <div className="overflow-x-auto font-mono text-xs">
      {diff.split("\n").map((line, index) => {
        const isAddition = line.startsWith("+") && !line.startsWith("+++");
        const isRemoval = line.startsWith("-") && !line.startsWith("---");
        const isHunk = line.startsWith("@@");
        const isHeader = line.startsWith("+++") || line.startsWith("---") || line.startsWith("***");

        return (
          <div
            key={`${index}-${line}`}
            className={`grid grid-cols-[3rem_minmax(0,1fr)] border-b border-border/20 last:border-b-0 ${
              isAddition
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : isRemoval
                  ? "bg-rose-500/10 text-rose-800 dark:text-rose-200"
                  : isHunk
                    ? "bg-sky-500/10 text-sky-800 dark:text-sky-200"
                    : isHeader
                      ? "bg-muted/50 text-muted-foreground"
                      : "text-muted-foreground/80"
            }`}
          >
            <span className="select-none border-r border-border/30 px-2 py-0.5 text-right text-muted-foreground/50">
              {index + 1}
            </span>
            <span className="whitespace-pre px-2 py-0.5">{line || " "}</span>
          </div>
        );
      })}
    </div>
  );
}