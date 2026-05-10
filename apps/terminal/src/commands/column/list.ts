import { Command, Flags } from "@oclif/core";
import { KanbanColumn } from "@onezone/shared";

export default class ColumnList extends Command {
  static description = "List all columns for a project";

  static examples = [
    "<%= config.bin %> column list --project <uuid>",
    "<%= config.bin %> column list --project <uuid> --server http://localhost:5026",
  ];

  static flags = {
    project: Flags.string({
      description: "Project ID (UUID)",
      required: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ColumnList);

    let columns: KanbanColumn[];
    try {
      const url = `${flags.server}/projects/${flags.project}/kanban-columns`;
      const response = await fetch(url);
      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
      columns = (await response.json()) as KanbanColumn[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    if (columns.length === 0) {
      this.log("No columns found.");
      return;
    }

    const idWidth = Math.max(36, ...columns.map((c) => c.id.length));
    const nameWidth = Math.max(4, ...columns.map((c) => c.name.length));
    const indexWidth = 5;

    const header =
      "ID".padEnd(idWidth) +
      "  " +
      "Index".padEnd(indexWidth) +
      "  " +
      "Name".padEnd(nameWidth);
    const divider =
      "-".repeat(idWidth) +
      "  " +
      "-".repeat(indexWidth) +
      "  " +
      "-".repeat(nameWidth);

    this.log(header);
    this.log(divider);

    for (const column of columns) {
      this.log(
        column.id.padEnd(idWidth) +
          "  " +
          String(column.index).padEnd(indexWidth) +
          "  " +
          column.name,
      );
    }

    this.log(divider);
  }
}
