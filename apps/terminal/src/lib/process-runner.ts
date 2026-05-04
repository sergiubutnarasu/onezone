import { MessageStream } from "@onezone/shared";
import { ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";

// Track all active child processes so we can clean them up on exit.
const activeProcs = new Set<ChildProcess>();

function killAll() {
  for (const proc of activeProcs) {
    try {
      process.kill(-proc.pid!, "SIGTERM");
    } catch {
      /* already dead */
    }
  }
}

// Call once at the application entry point to register process cleanup handlers.
export function registerCleanupHandlers(): void {
  process.on("exit", killAll);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

export function runProcess({
  cmd,
  args,
  onLine,
  onExit,
  shell = false,
}: {
  cmd: string;
  args: string[];
  onLine: (stream: MessageStream, line: string) => void;
  onExit: (code: number) => void;
  shell?: boolean;
}): ChildProcess {
  // detached: true puts the child in its own process group so process.kill(-pid)
  // correctly targets only that child's group.
  const proc = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell,
    detached: true,
  });
  activeProcs.add(proc);

  // Use readline to read the child's stdout and stderr line by line.
  createInterface({ input: proc.stdout }).on("line", (line) =>
    onLine(MessageStream.Stdout, line),
  );

  // Buffer stderr and only emit it on exit, to avoid interleaving with stdout lines.
  createInterface({ input: proc.stderr }).on("line", (line) =>
    onLine(MessageStream.Stderr, line),
  );

  // Node always emits 'close' after 'error', so guard against double-calling onExit.
  let exited = false;
  const finish = (code: number) => {
    if (exited) return;
    exited = true;
    activeProcs.delete(proc);
    // Kill any remaining processes the agent spawned (e.g. dev servers, test watchers).
    // Since the child runs detached in its own process group, this terminates the whole group.
    if (proc.pid) {
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch {
        // Process group is already gone — nothing to do.
      }
    }
    onExit(code);
  };

  proc.on("close", (code) => finish(code ?? -1));
  proc.on("error", (err) => {
    onLine(MessageStream.Stderr, `Process error: ${err.message}`);
    finish(-1);
  });

  return proc;
}
