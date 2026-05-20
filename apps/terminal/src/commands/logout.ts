// apps/terminal/src/commands/logout.ts

import { Command, Flags } from "@oclif/core";
import { getRefreshToken, clearTokens } from "../lib/config.js";

export default class Logout extends Command {
  static description = "Log out and clear stored credentials";

  static flags = {
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Logout);
    const baseUrl = flags.server;
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      try {
        await fetch(`${baseUrl}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Ignore errors — still clear local tokens
      }
    }

    clearTokens();
    this.log("Logged out successfully.");
  }
}
