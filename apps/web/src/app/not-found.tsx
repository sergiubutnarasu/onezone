import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
        <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10 ring-1 ring-primary/15">
          <Logo className="scale-[1.7]" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            404 · Not found
          </p>
          <h1 className="text-display text-balance">
            This page wandered off.
          </h1>
          <p className="text-sm text-muted-foreground text-balance max-w-sm mx-auto">
            The route you asked for doesn&apos;t exist, or it moved and we forgot
            to leave a forwarding address.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Home className="size-4" />
            Back to projects
          </Link>
          <Link
            href="/agents"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Search className="size-4" />
            Browse agents
          </Link>
        </div>
      </div>
    </div>
  );
}
