"use client";

import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { RefreshCw } from "lucide-react";

/**
 * Global error boundary. Renders OUTSIDE the root layout, so it must not
 * depend on CSS variables or any client component that requires the app
 * shell. Inline the minimum styles needed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          background: "#0d0f15",
          color: "#e8eaef",
          fontFamily:
            'Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          margin: 0,
        }}
        className="w-full flex flex-col items-center justify-center px-6 antialiased"
      >
        <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
          <div
            style={{
              background: "rgba(217, 119, 119, 0.10)",
              borderColor: "rgba(217, 119, 119, 0.15)",
            }}
            className="flex items-center justify-center size-14 rounded-2xl ring-1"
          >
            <Logo className="scale-[1.7]" />
          </div>

          <div className="space-y-2">
            <p
              style={{ letterSpacing: "0.18em", color: "#7c8290" }}
              className="font-mono text-xs uppercase"
            >
              500 · Something broke
            </p>
            <h1 className="text-[1.75rem] md:text-[2.25rem] font-semibold tracking-[-0.02em] leading-[1.1] text-balance">
              We hit a snag on our end.
            </h1>
            <p
              style={{ color: "#7c8290" }}
              className="text-sm text-balance max-w-sm mx-auto"
            >
              The page failed to load. Reloading usually clears it up. If it
              keeps happening, the error has been logged.
            </p>
            {error.digest && (
              <p
                style={{ color: "#5a5f6b" }}
                className="font-mono text-[11px] mt-3"
              >
                ref: {error.digest}
              </p>
            )}
          </div>

          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{
              background: "#5a8dee",
              color: "#0d0f15",
            }}
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
