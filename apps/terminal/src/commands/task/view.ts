import { Args, Command, Flags } from "@oclif/core";
import type { Task } from "@onezone/shared";
import { authenticatedFetch } from "../../lib/config.js";

export default class TaskViewCommand extends Command {
  static description = "View details of a task";

  static examples = [
    "<%= config.bin %> task view <task-id>",
    "<%= config.bin %> task view <task-id> --server http://localhost:5026",
  ];

  static args = {
    id: Args.string({ description: "Task ID (UUID)", required: true }),
  };

  static flags = {
    server: Flags.string({
      description: "Server URL",
      default: "http://localhost:5026",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TaskViewCommand);
    const baseUrl = flags.server;

    let task: Task;
    try {
      const response = await authenticatedFetch(`${baseUrl}/tasks/${args.id}`, {}, baseUrl);

      if (!response.ok) {
        this.error(
          `Server returned ${response.status}: ${response.statusText}`,
          { exit: 1 },
        );
      }
      task = (await response.json()) as Task;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.error(message, { exit: 1 });
    }

    this.log(`ID:          ${task.id}`);
    this.log(`Name:        ${task.name}`);
    this.log(`Description: ${task.description ?? "-"}`);
    this.log(`Column:      ${(task as unknown as { columnName?: string | null }).columnName ?? 'Backlog'}`);
    this.log(`Terminal:    ${task.terminal?.name ?? "-"}`);
  }
}
