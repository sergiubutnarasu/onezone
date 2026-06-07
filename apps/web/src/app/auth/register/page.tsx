"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { register, safeReturnTo } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await register(email, password, name);
      // If the server returns a message (email already registered — same 201 response),
      // redirect to login
      if ("message" in result && result.message) {
        router.push("/auth/login");
        return;
      }
      await refetch();
      router.push(safeReturnTo(searchParams.get("returnTo")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[22.5rem] px-4">
      <div className="flex flex-col items-center mb-8 gap-3">
        <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10 ring-1 ring-primary/15">
          <Logo className="scale-150" />
        </div>
        <h1 className="text-display">Onezone</h1>
        <p className="text-sm text-muted-foreground">Create your account</p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <h2 className="text-base font-medium">Get started</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="name">
                Name
              </label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
