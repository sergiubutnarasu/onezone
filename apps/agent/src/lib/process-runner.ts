import { spawn, ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export type StreamType = "stdout" | "stderr";

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

// Register cleanup handlers once, not once per runProcess call.
process.on("exit", killAll);
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

export function runProcess(
  cmd: string,
  args: string[],
  onLine: (stream: StreamType, line: string) => void,
  onExit: (code: number) => void,
  shell = false,
): ChildProcess {
  // detached: true puts the child in its own process group so process.kill(-pid)
  // correctly targets only that child's group.
  const proc = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell,
    detached: true,
  });
  activeProcs.add(proc);

  createInterface({ input: proc.stdout }).on("line", (line) =>
    onLine("stdout", line),
  );
  createInterface({ input: proc.stderr }).on("line", (line) =>
    onLine("stderr", line),
  );

  // Node always emits 'close' after 'error', so guard against double-calling onExit.
  let exited = false;
  const finish = (code: number) => {
    if (exited) return;
    exited = true;
    activeProcs.delete(proc);
    onExit(code);
  };

  proc.on("close", (code) => finish(code ?? -1));
  proc.on("error", (err) => {
    onLine("stderr", `Process error: ${err.message}`);
    finish(-1);
  });

  return proc;
}
