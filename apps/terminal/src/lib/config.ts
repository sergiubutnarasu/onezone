// apps/terminal/src/lib/config.ts
// Manages persistent auth tokens stored in the OS keychain via @napi-rs/keyring

import { Entry } from "@napi-rs/keyring";

const SERVICE_NAME = "onezone";

export async function getAccessToken(): Promise<string | undefined> {
  const entry = new Entry(SERVICE_NAME, "access_token");
  try {
    return (await entry.getPassword()) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function getRefreshToken(): Promise<string | undefined> {
  const entry = new Entry(SERVICE_NAME, "refresh_token");
  try {
    return (await entry.getPassword()) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await new Entry(SERVICE_NAME, "access_token").setPassword(accessToken);
  await new Entry(SERVICE_NAME, "refresh_token").setPassword(refreshToken);
}

export async function clearTokens(): Promise<void> {
  try {
    await new Entry(SERVICE_NAME, "access_token").deletePassword();
  } catch {}
  try {
    await new Entry(SERVICE_NAME, "refresh_token").deletePassword();
  } catch {}
}

export async function refreshAccessToken(serverUrl: string): Promise<boolean> {
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
}
