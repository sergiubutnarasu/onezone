import { Command, Flags } from "@oclif/core";
import { authenticatedFetch } from "../../lib/config.js";

export default class MemoryRead extends Command {
  static description = "Read a memory file for a project";

  static examples = [
    "<%= config.bin %> memory read --project <uuid> --key wiki/architecture.md",
  ];

  static flags = {
    project: Flags.string({
      description: "Project ID (UUID)",
      required: true,
    }),
    key: Flags.string({
      description: "Memory file key (e.g. INDEX.md, wiki/architecture.md)",
      required: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: process.env.TERMINAL_SERVER_URL || "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MemoryRead);
    const baseUrl = flags.server;

    const url = new URL(
      `${baseUrl}/projects/${flags.project}/memory/${encodeURIComponent(flags.key)}`,
    );

    try {
      const response = await authenticatedFetch(url.toString(), {}, baseUrl);

      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }

      const data = (await response.json()) as { content: string | null };

      if (data.content === null) {
        this.error(`Memory file "${flags.key}" not found.`, { exit: 1 });
      }

      this.log(data.content);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }
  }
}
