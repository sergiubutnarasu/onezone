import { MessageStream } from "@onezone/shared";
import { ChildProcess, execSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * Recursively kill a process and all its descendants by walking the PPID tree.
 * This catches processes that were spawned in new process groups (e.g. detached
 * child processes started by the agent, like dev servers).
 */
export function killTree(pid: number): void {
  // Kill children first (depth-first) before the parent disappears.
  try {
    const out = execSync(`pgrep -P ${pid}`, { encoding: "utf8" }).trim();
    for (const child of out.split("\n").filter(Boolean)) {
      killTree(parseInt(child, 10));
    }
  } catch {
    // No children or pgrep failed — continue.
  }
  // Kill the process group (catches siblings that share the group).
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  // Kill the process itself in case it's not a group leader.
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

// Track all active child processes so we can clean them up on exit.
const activeProcs = new Set<ChildProcess>();

function killAll() {
  for (const proc of activeProcs) {
    if (proc.pid) killTree(proc.pid);
  }
}

// Call once at the application entry point to register process cleanup handlers.
export function registerCleanupHandlers(): void {
  process.on("exit", killAll);
  process.on("SIGINT", () => {
    killAll();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    killAll();
    process.exit(0);
  });
}

export function runProcess({
  cmd,
  cwd,
  args,
  onLine,
  onExit,
  shell = false,
}: {
  cmd: string;
  cwd: string;
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
    cwd,
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
    // Walk the full PPID tree so detached child process groups are also terminated.
    if (proc.pid) {
      killTree(proc.pid);
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
