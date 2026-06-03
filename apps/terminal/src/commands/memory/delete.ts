import { Command, Flags } from "@oclif/core";
import { authenticatedFetch } from "../../lib/config.js";

export default class MemoryDelete extends Command {
  static description = "Delete a memory file for a project";

  static examples = [
    "<%= config.bin %> memory delete --project <uuid> --key raw/2026-06-01-fix.md",
  ];

  static flags = {
    project: Flags.string({
      description: "Project ID (UUID)",
      required: true,
    }),
    key: Flags.string({
      description: "Memory file key",
      required: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: process.env.TERMINAL_SERVER_URL || "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MemoryDelete);
    const baseUrl = flags.server;

    const url = new URL(
      `${baseUrl}/projects/${flags.project}/memory/${encodeURIComponent(flags.key)}`,
    );

    try {
      const response = await authenticatedFetch(
        url.toString(),
        { method: "DELETE" },
        baseUrl,
      );

      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }

      this.log(`Deleted memory file: ${flags.key}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }
  }
}
