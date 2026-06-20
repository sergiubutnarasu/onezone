import type { Agent as SharedAgent } from "@onezone/shared";

/** Web-specific extension of the shared Agent type. */
export interface Agent extends SharedAgent {
  defaultModel?: string;
  userModel?: string | null;
}
