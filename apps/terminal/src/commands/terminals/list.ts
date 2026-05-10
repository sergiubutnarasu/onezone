import { Command, Flags } from "@oclif/core";
import type { Terminal } from "@onezone/shared";

export default class TerminalsList extends Command {
  static description = "List all terminals registered on the server";

  static examples = [
    "<%= config.bin %> terminals list",
    "<%= config.bin %> terminals list --server http://localhost:5026",
  ];

  static flags = {
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TerminalsList);

    let terminals: Terminal[];
    try {
      const response = await fetch(`${flags.server}/terminals`);
      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
      terminals = (await response.json()) as Terminal[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    if (terminals.length === 0) {
      this.log("No terminals registered.");
      return;
    }

    const idWidth = Math.max(36, ...terminals.map((t) => t.id.length));
    const nameWidth = Math.max(4, ...terminals.map((t) => t.name.length));
    const statusWidth = 12;

    const header =
      "ID".padEnd(idWidth) +
      "  " +
      "Name".padEnd(nameWidth) +
      "  " +
      "Status".padEnd(statusWidth);
    const divider =
      "-".repeat(idWidth) +
      "  " +
      "-".repeat(nameWidth) +
      "  " +
      "-".repeat(statusWidth);

    this.log(header);
    this.log(divider);

    for (const terminal of terminals) {
      const status = terminal.isConnected ? "connected" : "disconnected";
      this.log(
        terminal.id.padEnd(idWidth) +
          "  " +
          terminal.name.padEnd(nameWidth) +
          "  " +
          status,
      );
    }

    this.log(divider);
  }
}
