import { Command, Flags } from "@oclif/core";
import { Task } from "@onezone/shared";

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
      const response = await fetch(
        `${flags.server}/projects/${flags.project}/tasks`,
      );
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
    const agentWidth = Math.max(
      5,
      ...tasks.map((t) => (t.agent?.name ?? "-").length),
    );

    const header =
      "ID".padEnd(idWidth) +
      "  " +
      "Name".padEnd(nameWidth) +
      "  " +
      "Status".padEnd(statusWidth) +
      "  " +
      "Agent".padEnd(agentWidth);
    const divider =
      "-".repeat(idWidth) +
      "  " +
      "-".repeat(nameWidth) +
      "  " +
      "-".repeat(statusWidth) +
      "  " +
      "-".repeat(agentWidth);

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
          (task.agent?.name ?? "-"),
      );
    }

    this.log(divider);
  }
}
