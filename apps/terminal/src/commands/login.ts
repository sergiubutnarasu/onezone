// apps/terminal/src/commands/login.ts

import { Command, Flags } from "@oclif/core";
import { setTokens } from "../lib/config.js";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  error?: string;
  access_token?: string;
  refresh_token?: string;
}

export default class Login extends Command {
  static description = "Authenticate via device flow";

  static flags = {
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Login);
    const baseUrl = flags.server;

    // Step 1: request device code
    const deviceRes = await fetch(`${baseUrl}/auth/device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!deviceRes.ok) {
      this.error(`Failed to initiate device flow (HTTP ${deviceRes.status})`, { exit: 1 });
    }

    const device = (await deviceRes.json()) as DeviceCodeResponse;

    this.log(`\nUser code:  ${device.user_code}`);
    this.log(`Open ${device.verification_uri} to activate`);
    this.log("\nWaiting for activation...\n");

    // Step 2: poll for token
    let interval = device.interval * 1000;

    while (true) {
      await new Promise((r) => setTimeout(r, interval));

      const tokenRes = await fetch(`${baseUrl}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: device.device_code }),
      });

      const result = (await tokenRes.json()) as TokenResponse;

      if (result.error === "slow_down") {
        interval += 5000;
        continue;
      }

      if (result.error === "authorization_pending") {
        continue;
      }

      if (result.error === "expired_token") {
        this.error("Device code expired. Please run login again.", { exit: 1 });
      }

      if (result.error) {
        this.error(`Authentication failed: ${result.error}`, { exit: 1 });
      }

      if (result.access_token && result.refresh_token) {
        await setTokens(result.access_token, result.refresh_token);
        this.log("Logged in successfully.");
        return;
      }
    }
  }
}
