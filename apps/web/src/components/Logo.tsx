import { cn } from "@/lib/utils";

/**
 * Onezone monogram: a 2x2 quadrant mark with the top-right cell filled
 * and a 1px inset gap. Reads as "one zone" without being literal.
 * Pairs with the wordmark in nav, auth headers, and OG previews.
 */
export function Logo({
  className,
  withWordmark = false,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-5 shrink-0"
        fill="none"
      >
        <rect x="1" y="1" width="6" height="6" rx="1.25" className="fill-primary" />
        <rect
          x="9"
          y="1"
          width="6"
          height="6"
          rx="1.25"
          className="fill-primary/25"
        />
        <rect
          x="1"
          y="9"
          width="6"
          height="6"
          rx="1.25"
          className="fill-primary/25"
        />
        <rect
          x="9"
          y="9"
          width="6"
          height="6"
          rx="1.25"
          className="fill-primary/25"
        />
      </svg>
      {withWordmark && (
        <span className="font-semibold text-[0.925rem] tracking-tight">
          Onezone
        </span>
      )}
    </span>
  );
}
