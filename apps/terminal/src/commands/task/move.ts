import { Command, Flags } from "@oclif/core";
import { authenticatedFetch } from "../../lib/config.js";

export default class TaskMoveCommand extends Command {
  static description = "Move a task to a kanban column";

  static examples = [
    "<%= config.bin %> task move --task <uuid> --column <column-uuid>",
    "<%= config.bin %> task move --task <uuid> --column backlog",
  ];

  static flags = {
    task: Flags.string({
      description: "Task ID (UUID)",
      required: true,
    }),
    column: Flags.string({
      description: 'Column ID (UUID) or "backlog" to move to the backlog',
      required: true,
    }),
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskMoveCommand);
    const baseUrl = flags.server;
    const columnId = flags.column === "backlog" ? null : flags.column;

    try {
      const response = await authenticatedFetch(
        `${baseUrl}/tasks/${flags.task}/column`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId }),
        },
        baseUrl,
      );

      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    const target = columnId ?? "backlog";
    this.log(`Task ${flags.task} moved to ${target}.`);
  }
}
