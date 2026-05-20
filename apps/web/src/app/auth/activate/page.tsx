"use client";

import { useState } from "react";
import { activateDevice } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle, Terminal } from "lucide-react";

export default function ActivatePage() {
  const [userCode, setUserCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Normalise input: uppercase and auto-insert dash after 4 chars
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.toUpperCase().replace(/[^A-Z2-9-]/g, "");
    // Auto-insert dash
    if (val.length === 4 && !val.includes("-")) {
      val = val + "-";
    }
    if (val.length > 9) val = val.slice(0, 9);
    setUserCode(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("loading");
    try {
      const result = await activateDevice(userCode);
      if (result.approved) {
        setStatus("success");
      } else {
        setErrorMsg("Code not found or already expired.");
        setStatus("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Activation failed");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="w-full max-w-sm px-4">
        <Card className="border-border/60">
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center size-12 rounded-full bg-green-500/10">
              <CheckCircle className="size-6 text-green-500" />
            </div>
            <div>
              <p className="font-semibold">Device activated!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your terminal is now authenticated. You can close this page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="flex flex-col items-center mb-8 gap-3">
        <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10">
          <Terminal className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Activate device</h1>
        <p className="text-sm text-muted-foreground text-center">
          Enter the code shown in your terminal.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <h2 className="text-base font-medium">Enter activation code</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              value={userCode}
              onChange={handleChange}
              placeholder="XXXX-XXXX"
              className="text-center text-lg font-mono tracking-widest"
              autoComplete="off"
              autoFocus
            />

            {status === "error" && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}

            <Button
              type="submit"
              disabled={status === "loading" || userCode.length !== 9}
              className="w-full"
            >
              {status === "loading" ? "Activating…" : "Activate"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
