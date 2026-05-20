// apps/terminal/src/commands/whoami.ts

import { Command, Flags } from "@oclif/core";
import { getAccessToken, refreshAccessToken } from "../lib/config.js";

interface MeResponse {
  id: string;
  email: string;
  name?: string;
}

export default class Whoami extends Command {
  static description = "Show current authenticated user information";

  static flags = {
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Whoami);
    const baseUrl = flags.server;

    let token = await getAccessToken();
    if (!token) {
      this.error("Not authenticated. Run login first.", { exit: 1 });
    }

    let res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      const refreshed = await refreshAccessToken(baseUrl);
      if (!refreshed) {
        this.error("Not authenticated. Run login first.", { exit: 1 });
      }
      token = await getAccessToken();
      res = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (!res.ok) {
      this.error(`Failed to get user info (HTTP ${res.status})`, { exit: 1 });
    }

    const user = (await res.json()) as MeResponse;
    this.log(`Email: ${user.email}`);
    this.log(`User ID: ${user.id}`);
  }
}
