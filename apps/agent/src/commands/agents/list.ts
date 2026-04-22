import { Command, Flags } from "@oclif/core";
import { Agent } from "@onezone/shared";

export default class AgentsList extends Command {
  static description = "List all agents registered on the server";

  static examples = [
    "<%= config.bin %> agents list",
    "<%= config.bin %> agents list --server http://localhost:5026",
  ];

  static flags = {
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AgentsList);

    let agents: Agent[];
    try {
      const response = await fetch(`${flags.server}/agents`);
      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
      agents = (await response.json()) as Agent[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    if (agents.length === 0) {
      this.log("No agents registered.");
      return;
    }

    const idWidth = Math.max(36, ...agents.map((a) => a.id.length));
    const nameWidth = Math.max(4, ...agents.map((a) => a.name.length));
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

    for (const agent of agents) {
      const status = agent.isConnected ? "connected" : "disconnected";
      this.log(
        agent.id.padEnd(idWidth) +
          "  " +
          agent.name.padEnd(nameWidth) +
          "  " +
          status,
      );
    }

    this.log(divider);
  }
}
