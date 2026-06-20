// apps/terminal/src/lib/config.ts
// Manages persistent auth tokens stored in the OS keychain via @napi-rs/keyring,
// with a file-based fallback (~/.onezone/tokens.json) for environments without
// a secret service (e.g. Docker).

import { Entry } from "@napi-rs/keyring";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { SERVICE_NAME } from './constants.js';

const TOKEN_FILE = join(homedir(), ".onezone", "tokens.json");

interface TokenFileInternal {
  access_token?: string;
  refresh_token?: string;
}

async function readTokenFile(): Promise<TokenFileInternal> {
  try {
    const data = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data) as TokenFileInternal;
  } catch {
    return {};
  }
}

async function writeTokenFile(tokens: TokenFileInternal): Promise<void> {
  await mkdir(join(homedir(), ".onezone"), { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o600 });
}

export async function getAccessToken(): Promise<string | undefined> {
  const entry = new Entry(SERVICE_NAME, "access_token");
  try {
    return (await entry.getPassword()) ?? undefined;
  } catch {
    return (await readTokenFile()).access_token;
  }
}

export async function getRefreshToken(): Promise<string | undefined> {
  const entry = new Entry(SERVICE_NAME, "refresh_token");
  try {
    return (await entry.getPassword()) ?? undefined;
  } catch {
    return (await readTokenFile()).refresh_token;
  }
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  try {
    await new Entry(SERVICE_NAME, "access_token").setPassword(accessToken);
    await new Entry(SERVICE_NAME, "refresh_token").setPassword(refreshToken);
  } catch {
    await writeTokenFile({ access_token: accessToken, refresh_token: refreshToken });
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await new Entry(SERVICE_NAME, "access_token").deletePassword();
  } catch {}
  try {
    await new Entry(SERVICE_NAME, "refresh_token").deletePassword();
  } catch {}
  try {
    await rm(TOKEN_FILE);
  } catch {}
}

let activeRefreshPromise: Promise<boolean> | null = null;

export async function refreshAccessToken(serverUrl: string): Promise<boolean> {
  if (activeRefreshPromise) return activeRefreshPromise;

  activeRefreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${serverUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as { access_token?: string; refresh_token?: string };
      if (!data.access_token || !data.refresh_token) return false;

      await setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    activeRefreshPromise = null;
  });

  return activeRefreshPromise;
}

/**
 * Fetch with automatic Bearer token injection and a single retry after token refresh.
 * Throws if not authenticated or if the refresh fails.
 */
export async function authenticatedFetch(
  url: string,
  init: RequestInit = {},
  serverUrl: string,
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not authenticated. Run login first.");
  }

  const withAuth = (t: string): RequestInit => ({
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${t}` },
  });

  let res = await fetch(url, withAuth(token));

  if (res.status === 401) {
    const refreshed = await refreshAccessToken(serverUrl);
    if (!refreshed) {
      throw new Error("Not authenticated. Run login first.");
    }
    const newToken = await getAccessToken();
    res = await fetch(url, withAuth(newToken!));
  }

  return res;
}
