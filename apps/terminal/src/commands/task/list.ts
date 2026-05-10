import { Command, Flags } from "@oclif/core";
import type { Task } from "@onezone/shared";

export default class TaskList extends Command {
  static description = "List all tasks for a project";

  static examples = [
    "<%= config.bin %> task list --project <uuid>",
    "<%= config.bin %> task list --project <uuid> --server http://localhost:5026",
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
    const { flags } = await this.parse(TaskList);

    let tasks: Task[];
    try {
      const url = new URL(`${flags.server}/projects/${flags.project}/tasks`);
      const response = await fetch(url.toString());
      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
      tasks = (await response.json()) as Task[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    if (tasks.length === 0) {
      this.log("No tasks found.");
      return;
    }

    const columnLabel = (t: Task) => t.columnId ? (t as unknown as { columnName?: string | null }).columnName ?? t.columnId : 'Backlog';
    const idWidth = Math.max(36, ...tasks.map((t) => t.id.length));
    const nameWidth = Math.max(4, ...tasks.map((t) => t.name.length));
    const columnWidth = Math.max(6, ...tasks.map((t) => columnLabel(t).length));
    const terminalWidth = Math.max(
      8,
      ...tasks.map((t) => (t.terminal?.name ?? "-").length),
    );

    const header =
      "ID".padEnd(idWidth) +
      "  " +
      "Name".padEnd(nameWidth) +
      "  " +
      "Column".padEnd(columnWidth) +
      "  " +
      "Terminal".padEnd(terminalWidth);
    const divider =
      "-".repeat(idWidth) +
      "  " +
      "-".repeat(nameWidth) +
      "  " +
      "-".repeat(columnWidth) +
      "  " +
      "-".repeat(terminalWidth);

    this.log(header);
    this.log(divider);

    for (const task of tasks) {
      this.log(
        task.id.padEnd(idWidth) +
          "  " +
          task.name.padEnd(nameWidth) +
          "  " +
          columnLabel(task).padEnd(columnWidth) +
          "  " +
          (task.terminal?.name ?? "-"),
      );
    }

    this.log(divider);
  }
}
