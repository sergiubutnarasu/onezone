// apps/terminal/src/commands/whoami.ts

import { Command, Flags } from "@oclif/core";
import { authenticatedFetch } from "../lib/config.js";

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

    let res: Response;
    try {
      res = await authenticatedFetch(`${baseUrl}/auth/me`, {}, baseUrl);
    } catch (err: unknown) {
      this.error(err instanceof Error ? err.message : String(err), { exit: 1 });
    }

    if (!res.ok) {
      this.error(`Failed to get user info (HTTP ${res.status})`, { exit: 1 });
    }

    const user = (await res.json()) as MeResponse;
    this.log(`Email: ${user.email}`);
    this.log(`User ID: ${user.id}`);
  }
}
