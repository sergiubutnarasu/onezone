import { Args, Command, Flags } from "@oclif/core";
import type { KanbanColumn } from "@onezone/shared";

export default class ColumnView extends Command {
  static description = "View details of a column";

  static examples = [
    "<%= config.bin %> column view <column-id> --project <uuid>",
    "<%= config.bin %> column view <column-id> --project <uuid> --server http://localhost:5026",
  ];

  static args = {
    id: Args.string({ description: "Column ID (UUID)", required: true }),
  };

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
    const { args, flags } = await this.parse(ColumnView);

    let column: KanbanColumn;
    try {
      const url = `${flags.server}/projects/${flags.project}/kanban-columns/${args.id}`;
      const response = await fetch(url);
      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
      column = (await response.json()) as KanbanColumn;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    this.log(`ID:           ${column.id}`);
    this.log(`Name:         ${column.name}`);
    this.log(`Instructions: ${column.instructions ?? "-"}`);
    this.log(`Index:        ${column.index}`);
    this.log(`Project ID:   ${column.projectId}`);
    this.log(`Created At:   ${column.createdAt}`);
  }
}
