// apps/terminal/src/lib/config.ts
// Manages persistent auth config stored in ~/.onezone/config.json

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ONEZONE_BASE_LOCATION } from "./constants.js";

interface Config {
  accessToken?: string;
  refreshToken?: string;
}

const configDir = path.join(os.homedir(), ONEZONE_BASE_LOCATION);
const configFile = path.join(configDir, "config.json");

function readConfig(): Config {
  try {
    const raw = fs.readFileSync(configFile, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return {};
  }
}

function writeConfig(config: Config): void {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getAccessToken(): string | undefined {
  return readConfig().accessToken;
}

export function getRefreshToken(): string | undefined {
  return readConfig().refreshToken;
}

export function setTokens(accessToken: string, refreshToken: string): void {
  const config = readConfig();
  writeConfig({ ...config, accessToken, refreshToken });
}

export function clearTokens(): void {
  const config = readConfig();
  const { accessToken: _, refreshToken: __, ...rest } = config;
  writeConfig(rest);
}

export async function refreshAccessToken(serverUrl: string): Promise<boolean> {
  const refreshToken = getRefreshToken();
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

    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}
