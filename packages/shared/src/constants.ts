// packages/shared/src/constants.ts

/** Heartbeat interval for terminal → server keep-alive pings. */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Terminals are considered stale (disconnected) if no heartbeat is received
 * within this window. Must be greater than HEARTBEAT_INTERVAL_MS.
 */
export const STALE_THRESHOLD_MS = 10_000;

/** Sentinel ID used in the UI to represent the virtual "Backlog" column (no DB entry). */
export const BACKLOG_COLUMN_ID = "__backlog__";

/** Sentinel ID used in the UI to represent the virtual "Completed" column (no DB entry). */
export const COMPLETED_COLUMN_ID = "__completed__";

/** Predefined cron expressions for the UI. */
export const CRON_PRESETS: { label: string; value: string }[] = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 3 minutes", value: "*/3 * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 10 minutes", value: "*/10 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 25 minutes", value: "*/25 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 3 hours", value: "0 */3 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
];
