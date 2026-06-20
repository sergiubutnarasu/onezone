// apps/web/src/lib/auth/refresh.ts
// Singleton token-refresh helper shared by the HTTP client and the socket layer.

import { API_BASE } from "@/constants";

let refreshPromise: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
