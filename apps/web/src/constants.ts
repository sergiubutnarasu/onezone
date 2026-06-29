// apps/web/src/constants.ts
// Pure constants — no functions. Values that never change at runtime.

/**
 * Base URL for the Onezone API.
 *
 * In the browser, derive the API host from the current page location so the
 * API calls are always same-origin (same hostname + port scheme). This avoids
 * CORS and cross-site cookie issues when accessing the app via different
 * hostnames (e.g. Tailscale .local domains, LAN IPs, etc.).
 *
 * On the server (SSR), fall back to the build-time NEXT_PUBLIC_API_URL so
 * server-side fetches still work.
 */
export const API_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5026`
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5026";

/** localStorage key for theme preference. */
export const THEME_STORAGE_KEY = "theme";

/** Max height (px) of a collapsed rich-text description before the expand toggle appears. */
export const COLLAPSED_MAX_HEIGHT = 72; // ~3 lines

/** Tailwind colour classes used to rotate Kanban column header accents. */
export const COLUMN_COLORS = [
  "text-blue-400",
  "text-purple-400",
  "text-pink-400",
  "text-orange-400",
  "text-teal-400",
  "text-indigo-400",
  "text-rose-400",
  "text-cyan-400",
] as const;
