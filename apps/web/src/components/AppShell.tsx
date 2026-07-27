"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/register";

  if (isPublicRoute) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        {children}
      </div>
    );
  }

  if (isLoading) {
    // Show nothing while checking auth.
    return null;
  }

  if (!user) {
    // Session cookies exist but are no longer valid (e.g. expired refresh
    // token, or the account/database was reset) — the app can't just
    // redirect on its own here since middleware already let the request
    // through. Let the user force a clean logout instead of a blank page.
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Your session is no longer valid.
          </p>
          <Button onClick={logout}>Reset session</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppNav />
      <main className="flex-1 min-w-0 overflow-y-auto pt-12 md:pt-0">
        {children}
      </main>
    </div>
  );
}
