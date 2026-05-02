import { Command, Flags } from "@oclif/core";
import { Task, TaskStatus } from "@onezone/shared";

export default class TaskList extends Command {
  static description = "List all tasks for a project";

  static examples = [
    "<%= config.bin %> task list --project <uuid>",
    "<%= config.bin %> task list --project <uuid> --status PLANNING",
    "<%= config.bin %> task list --project <uuid> --status IN_PROGRESS --status PLANNING",
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
    status: Flags.string({
      description: "Filter by status (can be repeated)",
      options: Object.values(TaskStatus),
      multiple: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskList);

    let tasks: Task[];
    try {
      const url = new URL(`${flags.server}/projects/${flags.project}/tasks`);
      if (flags.status && flags.status.length > 0) {
        for (const s of flags.status) url.searchParams.append('status', s);
      }
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

    const idWidth = Math.max(36, ...tasks.map((t) => t.id.length));
    const nameWidth = Math.max(4, ...tasks.map((t) => t.name.length));
    const statusWidth = Math.max(6, ...tasks.map((t) => t.status.length));
    const terminalWidth = Math.max(
      8,
      ...tasks.map((t) => (t.terminal?.name ?? "-").length),
    );

    const header =
      "ID".padEnd(idWidth) +
      "  " +
      "Name".padEnd(nameWidth) +
      "  " +
      "Status".padEnd(statusWidth) +
      "  " +
      "Terminal".padEnd(terminalWidth);
    const divider =
      "-".repeat(idWidth) +
      "  " +
      "-".repeat(nameWidth) +
      "  " +
      "-".repeat(statusWidth) +
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
          task.status.padEnd(statusWidth) +
          "  " +
          (task.terminal?.name ?? "-"),
      );
    }

    this.log(divider);
  }
}
