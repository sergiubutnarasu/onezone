// packages/shared/src/constants.ts

/** Heartbeat interval for terminal → server keep-alive pings. */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Terminals are considered stale (disconnected) if no heartbeat is received
 * within this window. Must be greater than HEARTBEAT_INTERVAL_MS.
 */
export const STALE_THRESHOLD_MS = 10_000;
