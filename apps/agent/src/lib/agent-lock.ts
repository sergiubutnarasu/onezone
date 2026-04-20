import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const LOCK_FILE = "agent.lock";

export function getLockFilePath(dataDir: string): string {
  return join(dataDir, LOCK_FILE);
}

/**
 * Tries to acquire an exclusive per-device lock by writing the current PID.
 * If a lock file exists and its PID is still alive, returns false.
 * Stale locks (dead process) are silently replaced.
 */
export function acquireLock(lockPath: string): boolean {
  if (existsSync(lockPath)) {
    try {
      const pid = parseInt(readFileSync(lockPath, "utf-8").trim(), 10);
      if (!isNaN(pid) && pid !== process.pid) {
        try {
          process.kill(pid, 0); // Signal 0: check liveness without killing
          return false; // Process alive — lock is held
        } catch {
          // ESRCH: process gone — stale lock, take over
        }
      }
    } catch {
      // Unreadable lock — take it
    }
  }

  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, String(process.pid), "utf-8");
  return true;
}

/**
 * Releases the lock. Only deletes the file if this process owns it.
 */
export function releaseLock(lockPath: string): void {
  try {
    if (existsSync(lockPath)) {
      const pid = parseInt(readFileSync(lockPath, "utf-8").trim(), 10);
      if (pid === process.pid) {
        unlinkSync(lockPath);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}
