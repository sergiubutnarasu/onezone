import { Command, Flags } from "@oclif/core";
import { readFileSync } from "node:fs";
import { authenticatedFetch } from "../../lib/config.js";

export default class MemoryWrite extends Command {
  static description = "Write a memory file for a project";

  static examples = [
    "<%= config.bin %> memory write --project <uuid> --key wiki/architecture.md --content '# Architecture'",
    "<%= config.bin %> memory write --project <uuid> --key raw/2026-06-01-fix.md --file ./notes.md",
  ];

  static flags = {
    project: Flags.string({
      description: "Project ID (UUID)",
      required: true,
    }),
    key: Flags.string({
      description: "Memory file key (e.g. wiki/architecture.md)",
      required: true,
    }),
    content: Flags.string({
      description: "File content (inline)",
      required: false,
    }),
    file: Flags.string({
      description: "Path to local file to upload",
      required: false,
    }),
    server: Flags.string({
      description: "Server URL",
      default: process.env.TERMINAL_SERVER_URL || "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MemoryWrite);
    const baseUrl = flags.server;

    let content: string;
    if (flags.file) {
      try {
        content = readFileSync(flags.file, "utf-8");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.error(`Failed to read file: ${message}`, { exit: 1 });
      }
    } else if (flags.content) {
      content = flags.content;
    } else {
      this.error("Either --content or --file must be provided.", { exit: 1 });
    }

    const url = new URL(
      `${baseUrl}/projects/${flags.project}/memory/${encodeURIComponent(flags.key)}`,
    );

    try {
      const response = await authenticatedFetch(
        url.toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
        baseUrl,
      );

      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }

      this.log(`Wrote memory file: ${flags.key}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }
  }
}
