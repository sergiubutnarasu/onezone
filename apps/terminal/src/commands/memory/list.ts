import { Command, Flags } from "@oclif/core";
import { authenticatedFetch } from "../../lib/config.js";

export default class MemoryList extends Command {
  static description = "List memory files for a project";

  static examples = [
    "<%= config.bin %> memory list --project <uuid>",
    "<%= config.bin %> memory list --project <uuid> --prefix wiki/",
  ];

  static flags = {
    project: Flags.string({
      description: "Project ID (UUID)",
      required: true,
    }),
    prefix: Flags.string({
      description: "Optional prefix filter (e.g. wiki/ or raw/)",
      required: false,
    }),
    server: Flags.string({
      description: "Server URL",
      default: process.env.TERMINAL_SERVER_URL || "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MemoryList);
    const baseUrl = flags.server;

    const url = new URL(`${baseUrl}/projects/${flags.project}/memory`);
    if (flags.prefix) {
      url.searchParams.set("prefix", flags.prefix);
    }

    try {
      const response = await authenticatedFetch(url.toString(), {}, baseUrl);

      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }

      const data = (await response.json()) as { keys: string[] };

      if (data.keys.length === 0) {
        this.log("No memory files found.");
        return;
      }

      for (const key of data.keys) {
        this.log(key);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }
  }
}
