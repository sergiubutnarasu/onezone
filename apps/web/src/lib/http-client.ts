// apps/web/src/lib/http-client.ts

import { API_BASE } from "@/constants";
import { tryRefresh } from "./auth/refresh";

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (!isRetry) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return request<T>(path, options, true);
      }
    }
    // Redirect to login on auth failure (only in browser)
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${path}`);
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const httpClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body: JSON.stringify(body) });
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};

