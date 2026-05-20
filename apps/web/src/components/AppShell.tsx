"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/lib/auth-context";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/register";

  useEffect(() => {
    if (!isLoading && !user && !isPublicRoute) {
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, isPublicRoute, router, pathname]);

  if (isPublicRoute) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        {children}
      </div>
    );
  }

  if (isLoading || !user) {
    // Show nothing while checking auth or redirecting
    return null;
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
